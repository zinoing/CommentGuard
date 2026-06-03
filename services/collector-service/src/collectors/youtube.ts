import axios from "axios";
import crypto from "crypto";
import { prisma } from "@commentguard/db";
import { writeCommentSnapshot } from "../s3/snapshot";
import { consumeQuota, QuotaExceededError } from "../quota/tracker";

// YouTube Data API v3 unit costs
const QUOTA_UNITS = {
  commentThreadsList: 1,
};

const CLASSIFIER_URL = process.env.CLASSIFIER_URL ?? "http://localhost:8001";

export async function collectYouTubeComments(channelId: string, pageToken?: string) {
  const channel = await prisma.channel.findUniqueOrThrow({
    where: { id: channelId },
  });

  // CHECKLIST §8: quota usage tracked per API credential account
  try {
    await consumeQuota(channel.apiCredentialsRef, QUOTA_UNITS.commentThreadsList);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      console.error(err.message);
      return { provisional: true, comments: [], quotaExceeded: true };
    }
    throw err;
  }

  let response;
  try {
    response = await axios.get("https://www.googleapis.com/youtube/v3/commentThreads", {
      params: {
        part: "snippet",
        allThreadsRelatedToChannelId: channel.platformChannelId,
        maxResults: 100,
        pageToken,
        key: process.env.YOUTUBE_API_KEY,
      },
    });
  } catch (err: any) {
    // CHECKLIST §8: if required fields missing → alert ops, flag as provisional
    if (err.response?.status === 400 || err.response?.status === 404) {
      console.error("YouTube API schema change detected — switching to provisional mode");
      return { provisional: true, comments: [] };
    }
    throw err;
  }

  const items = response.data.items ?? [];
  const processedComments = [];

  for (const item of items) {
    const snippet = item.snippet?.topLevelComment?.snippet;
    if (!snippet) continue;

    const rawData = {
      platformCommentId: item.id,
      text: snippet.textDisplay,
      authorPlatformId: snippet.authorChannelId?.value ?? "unknown",
      publishedAt: snippet.publishedAt,
      likeCount: snippet.likeCount,
      videoId: item.snippet?.videoId,
    };

    // CHECKLIST §1: write snapshot FIRST, before any classification or action
    const { r2Key, sha256Hash } = await writeCommentSnapshot(channelId, item.id, rawData);

    const comment = await prisma.comment.upsert({
      where: { channelId_platformCommentId: { channelId, platformCommentId: item.id } },
      create: {
        channelId,
        platformCommentId: item.id,
        text: rawData.text,
        authorPlatformId: rawData.authorPlatformId,
        snapshotR2Key: r2Key,
        snapshotHash: sha256Hash,
      },
      update: {},
    });

    // Phase 1: call classifier directly via HTTP (no Kafka — Phase 3+)
    try {
      const classifyRes = await axios.post(`${CLASSIFIER_URL}/api/v1/classify`, {
        comment_id: comment.id,
        text: rawData.text,
        author_platform_id: rawData.authorPlatformId,
        channel_id: channelId,
        created_at: new Date().toISOString(),
      });
      const c = classifyRes.data;
      await prisma.riskAssessment.create({
        data: {
          commentId: comment.id,
          riskTypes: c.risk_types,
          legalScore: c.legal_score,
          brandScore: c.brand_score,
          urgencyScore: c.urgency_score,
          recommendedAction: c.recommended_action,
          modelVersion: c.model_version,
          classification: "reference_only",
          isProvisional: c.is_provisional ?? false,
        },
      });
    } catch (err) {
      // Classification failure must not block snapshot/comment storage
      console.error(`Classification failed for comment ${comment.id}:`, err);
    }

    // AccountPattern: upsert anomaly signals for this author (CHECKLIST §5)
    await upsertAccountPattern(rawData.authorPlatformId, channelId);

    processedComments.push(comment);
  }

  return {
    provisional: false,
    comments: processedComments,
    nextPageToken: response.data.nextPageToken,
  };
}

// Anonymized cluster token: SHA-256 of channelId prefix (no raw IP from YouTube API)
function ipClusterToken(channelId: string): string {
  return crypto.createHash("sha256").update(`cluster:${channelId}`).digest("hex").slice(0, 16);
}

async function upsertAccountPattern(authorPlatformId: string, channelId: string): Promise<void> {
  const existing = await prisma.accountPattern.findUnique({ where: { authorPlatformId } });
  const count = (existing?.commentCount30d ?? 0) + 1;

  await prisma.accountPattern.upsert({
    where: { authorPlatformId },
    create: {
      authorPlatformId,
      commentCount30d: 1,
      isNewAccount: true,
      ipClusterId: ipClusterToken(channelId),
    },
    update: {
      commentCount30d: count,
      isNewAccount: count <= 3,
      flaggedAt: count >= 10 ? new Date() : undefined,
    },
  });
}

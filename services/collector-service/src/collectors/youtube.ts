import axios from "axios";
import { prisma } from "@commentguard/db";
import { writeCommentSnapshot } from "../s3/snapshot";
import { consumeQuota, QuotaExceededError } from "../quota/tracker";
import { Kafka } from "kafkajs";

// YouTube Data API v3 unit costs
const QUOTA_UNITS = {
  commentThreadsList: 1, // list operation costs 1 unit
};

const kafka = new Kafka({
  clientId: "collector-service",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
});
const producer = kafka.producer();

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
    const { s3Key, sha256Hash } = await writeCommentSnapshot(
      channelId,
      item.id,
      rawData
    );

    const comment = await prisma.comment.upsert({
      where: {
        channelId_platformCommentId: {
          channelId,
          platformCommentId: item.id,
        },
      },
      create: {
        channelId,
        platformCommentId: item.id,
        text: rawData.text,
        authorPlatformId: rawData.authorPlatformId,
        snapshotS3Key: s3Key,
        snapshotHash: sha256Hash,
      },
      update: {},
    });

    // Publish to Kafka for downstream classification
    await producer.send({
      topic: "raw-comments",
      messages: [
        {
          key: comment.id,
          value: JSON.stringify({ commentId: comment.id, channelId }),
        },
      ],
    });

    processedComments.push(comment);
  }

  return {
    provisional: false,
    comments: processedComments,
    nextPageToken: response.data.nextPageToken,
  };
}

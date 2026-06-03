import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import axios from "axios";

// CHECKLIST §3: no code path executes a platform action without approved_by being set
// CHECKLIST §3: no scheduled job or background worker can trigger platform actions autonomously

const SYSTEM_IDS = new Set(["system", "bot", "auto", "scheduler"]);

export async function actionsRoute(app: FastifyInstance) {
  // Create pending action (no execution here)
  app.post("/", async (req, reply) => {
    const { commentId, actionType } = req.body as { commentId: string; actionType: string };

    const action = await prisma.action.create({
      data: {
        commentId,
        actionType: actionType as any,
        status: "PENDING",
        // approved_by intentionally NOT set here — requires separate approval step
      },
    });

    return reply.code(201).send(action);
  });

  // Approve and execute action
  app.post("/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { approvedById } = req.body as { approvedById: string };

    if (!approvedById) {
      return reply.code(400).send({ error: "approvedById is required" });
    }

    // CHECKLIST §3: approved_by must be a real user ID, never system/bot
    if (SYSTEM_IDS.has(approvedById.toLowerCase())) {
      return reply.code(403).send({ error: "Platform actions cannot be approved by system accounts" });
    }

    const approver = await prisma.user.findUnique({ where: { id: approvedById } });
    if (!approver) {
      return reply.code(400).send({ error: "approvedById must be a valid user ID" });
    }

    const action = await prisma.action.findUniqueOrThrow({
      where: { id },
      include: { comment: { include: { channel: true } } },
    });

    if (action.status !== "PENDING") {
      return reply.code(422).send({ error: `Action is already ${action.status}` });
    }

    await prisma.action.update({
      where: { id },
      data: { approvedById, approvedAt: new Date(), status: "APPROVED" },
    });

    try {
      const platformResponse = await executePlatformAction(action);
      await prisma.action.update({
        where: { id },
        data: { status: "EXECUTED", executedAt: new Date(), platformResponse },
      });
    } catch (err) {
      await prisma.action.update({
        where: { id },
        data: { status: "FAILED", platformResponse: { error: String(err) } },
      });
      return reply.code(502).send({ error: "Platform action execution failed" });
    }

    return prisma.action.findUnique({ where: { id } });
  });

  // List actions for a comment
  app.get("/comment/:commentId", async (req) => {
    const { commentId } = req.params as { commentId: string };
    return prisma.action.findMany({
      where: { commentId },
      orderBy: { createdAt: "desc" },
    });
  });
}

async function executePlatformAction(action: any): Promise<Record<string, unknown>> {
  const { actionType, comment } = action;
  const platformCommentId = comment.platformCommentId;
  const platform = comment.channel.platform;

  if (platform !== "YOUTUBE") {
    throw new Error(`Platform ${platform} not yet supported`);
  }

  // Retrieve channel OAuth token via apiCredentialsRef (stored externally, never in DB)
  const oauthToken = await getChannelOAuthToken(comment.channel.apiCredentialsRef);

  if (actionType === "HIDE") {
    // YouTube Data API v3: comments.setModerationStatus (held = hidden from public)
    const res = await axios.post(
      "https://www.googleapis.com/youtube/v3/comments/setModerationStatus",
      null,
      {
        params: { id: platformCommentId, moderationStatus: "heldForReview" },
        headers: { Authorization: `Bearer ${oauthToken}` },
      }
    );
    return { status: res.status, moderationStatus: "heldForReview" };
  }

  if (actionType === "DELETE" || actionType === "PRESERVE_AND_DELETE") {
    // YouTube Data API v3: comments.delete
    const res = await axios.delete("https://www.googleapis.com/youtube/v3/comments", {
      params: { id: platformCommentId },
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
    return { status: res.status, deleted: true };
  }

  if (actionType === "IGNORE") {
    return { ignored: true };
  }

  throw new Error(`Unknown actionType: ${actionType}`);
}

// Retrieves the OAuth access token for a channel via the credential reference.
// The reference points to a secrets store (AWS Secrets Manager in production).
// Phase 1: reads from environment variable named by the reference.
async function getChannelOAuthToken(credentialRef: string): Promise<string> {
  const envKey = `YOUTUBE_OAUTH_TOKEN_${credentialRef.toUpperCase().replace(/-/g, "_")}`;
  const token = process.env[envKey];
  if (!token) {
    throw new Error(`OAuth token not configured for credential ref: ${credentialRef}. Set env var ${envKey}`);
  }
  return token;
}

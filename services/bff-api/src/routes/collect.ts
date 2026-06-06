import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

const CLASSIFIER_URL = process.env.CLASSIFIER_URL ?? "http://risk-classifier:8001";
const BFF_CALLBACK_URL =
  process.env.BFF_CALLBACK_URL ?? "http://bff-api:3001/internal/collect/video-done";

// Tracks platform_comment_ids collected during a job for deletion detection at done event.
// Map<jobId, Set<platformCommentId>>
const _jobCollectedIds = new Map<string, Set<string>>();

function checkSecret(req: any, reply: any): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret || req.headers["x-internal-secret"] !== secret) {
    reply.code(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}

// External endpoints — POST /collect/start, GET /collect/status/:jobId, GET /collect/history
export async function collectRoute(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!checkSecret(req, reply)) return reply;
  });

  // Accept internal channel UUID (from cg_channel_id cookie via Next.js)
  app.post("/collect/start", async (req, reply) => {
    const { channelId } = req.body as { channelId?: string };
    if (!channelId) return reply.code(400).send({ error: "channelId is required" });

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, platformChannelId: true },
    });
    if (!channel) return reply.code(404).send({ error: "Channel not found" });

    const job = await prisma.collectJob.create({ data: { channelId } });

    try {
      const res = await fetch(`${CLASSIFIER_URL}/api/v1/collect/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          channel_id: channel.platformChannelId,
          callback_url: BFF_CALLBACK_URL,
        }),
      });
      if (!res.ok) throw new Error(`classifier returned ${res.status}`);
    } catch {
      await prisma.collectJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: "Failed to reach classifier service" },
      });
      return reply.code(502).send({ error: "Failed to start collection" });
    }

    await prisma.collectJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });
    return { jobId: job.id };
  });

  app.get("/collect/status/:jobId", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const job = await prisma.collectJob.findUnique({ where: { id: jobId } });
    if (!job) return reply.code(404).send({ error: "Job not found" });
    return {
      jobId: job.id,
      channelId: job.channelId,
      status: job.status,
      totalVideos: job.totalVideos,
      processedVideos: job.processedVideos,
      totalComments: job.totalComments,
      newComments: job.newComments,
      modifiedComments: job.modifiedComments,
      deletedComments: job.deletedComments,
      errorMessage: job.errorMessage,
      startedAt: job.createdAt,
      completedAt: job.status === "DONE" || job.status === "FAILED" ? job.updatedAt : null,
    };
  });

  // Returns recent CollectJobs for a channel (query param: channelId)
  app.get("/collect/history", async (req, reply) => {
    const { channelId } = req.query as { channelId?: string };
    if (!channelId) return reply.code(400).send({ error: "channelId is required" });

    const jobs = await prisma.collectJob.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return jobs.map((j) => ({
      jobId: j.id,
      status: j.status,
      totalComments: j.totalComments,
      newComments: j.newComments,
      modifiedComments: j.modifiedComments,
      deletedComments: j.deletedComments,
      errorMessage: j.errorMessage,
      startedAt: j.createdAt,
      completedAt: j.status === "DONE" || j.status === "FAILED" ? j.updatedAt : null,
    }));
  });
}

// Internal callback endpoint — POST /collect/video-done
// Called by Python risk-classifier; secured via INTERNAL_SECRET header
export async function internalCollectRoute(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (!checkSecret(req, reply)) return reply;
  });

  app.post("/collect/video-done", async (req, reply) => {
    const body = req.body as {
      job_id: string;
      event: "started" | "video_done" | "done" | "failed";
      total_videos?: number;
      video_id?: string;
      comments?: Array<{
        platform_comment_id: string;
        text: string;
        author_id: string;
        created_at: string;
      }>;
      error?: string;
    };

    const { job_id, event } = body;
    if (!job_id || !event) return reply.code(400).send({ error: "job_id and event are required" });

    switch (event) {
      case "started": {
        await prisma.collectJob.update({
          where: { id: job_id },
          data: { totalVideos: body.total_videos ?? 0 },
        });
        break;
      }

      case "video_done": {
        const job = await prisma.collectJob.findUnique({ where: { id: job_id } });
        if (!job) return reply.code(404).send({ error: "Job not found" });

        const comments = body.comments ?? [];

        // Ensure tracking set exists for this job
        if (!_jobCollectedIds.has(job_id)) {
          _jobCollectedIds.set(job_id, new Set());
        }
        const collectedIds = _jobCollectedIds.get(job_id)!;

        let newCount = 0;
        let modifiedCount = 0;
        let insertedCount = 0;

        for (const c of comments) {
          collectedIds.add(c.platform_comment_id);

          const existing = await prisma.comment.findUnique({
            where: {
              channelId_platformCommentId: {
                channelId: job.channelId,
                platformCommentId: c.platform_comment_id,
              },
            },
            select: { id: true, text: true },
          });

          if (!existing) {
            try {
              await prisma.comment.create({
                data: {
                  channelId: job.channelId,
                  platformCommentId: c.platform_comment_id,
                  text: c.text,
                  authorPlatformId: c.author_id,
                  createdAt: new Date(c.created_at),
                },
              });
              newCount++;
              insertedCount++;
            } catch {
              // race condition — another process inserted first, re-check for modified
              const recheck = await prisma.comment.findUnique({
                where: {
                  channelId_platformCommentId: {
                    channelId: job.channelId,
                    platformCommentId: c.platform_comment_id,
                  },
                },
                select: { text: true },
              });
              if (recheck && recheck.text !== c.text) modifiedCount++;
            }
          } else if (existing.text !== c.text) {
            // Comment exists but text differs — count as modified, don't update (immutable)
            modifiedCount++;
          }
        }

        await prisma.collectJob.update({
          where: { id: job_id },
          data: {
            processedVideos: { increment: 1 },
            totalComments: { increment: insertedCount },
            newComments: { increment: newCount },
            modifiedComments: { increment: modifiedCount },
          },
        });
        break;
      }

      case "done": {
        const job = await prisma.collectJob.findUnique({ where: { id: job_id } });
        if (!job) return reply.code(404).send({ error: "Job not found" });

        const collectedIds = _jobCollectedIds.get(job_id) ?? new Set<string>();

        // Detect deletions: DB comments not in this collection run
        const dbComments = await prisma.comment.findMany({
          where: { channelId: job.channelId },
          select: { platformCommentId: true },
        });

        const deletedCount = dbComments.filter(
          (c) => !collectedIds.has(c.platformCommentId)
        ).length;

        _jobCollectedIds.delete(job_id);

        await prisma.collectJob.update({
          where: { id: job_id },
          data: { status: "DONE", deletedComments: deletedCount },
        });
        break;
      }

      case "failed": {
        _jobCollectedIds.delete(job_id);
        await prisma.collectJob.update({
          where: { id: job_id },
          data: {
            status: "FAILED",
            errorMessage: body.error?.slice(0, 500) ?? null,
          },
        });
        break;
      }

      default:
        return reply.code(400).send({ error: "Unknown event" });
    }

    return { ok: true };
  });
}

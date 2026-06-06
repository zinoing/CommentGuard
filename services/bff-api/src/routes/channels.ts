import crypto from "node:crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

const CLASSIFIER_URL = process.env.CLASSIFIER_URL;
const BFF_CALLBACK_URL = process.env.BFF_CALLBACK_URL;

if (!CLASSIFIER_URL || !BFF_CALLBACK_URL) {
  throw new Error("CLASSIFIER_URL and BFF_CALLBACK_URL must be set");
}

// All routes in this file are called server-to-server via INTERNAL_SECRET
function checkSecret(req: any, reply: any): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret || req.headers["x-internal-secret"] !== secret) {
    reply.code(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}

export async function channelsRoute(app: FastifyInstance) {
  // GET /api/v1/channels
  app.get("/channels", async (req, reply) => {
    if (!checkSecret(req, reply)) return;

    const channels = await prisma.channel.findMany({
      select: {
        id: true,
        name: true,
        platformChannelId: true,
        platform: true,
        lastCollectedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return channels.map((c) => ({
      id: c.id,
      name: c.name,
      platformChannelId: c.platformChannelId,
      platform: c.platform,
      lastCollectedAt: c.lastCollectedAt,
    }));
  });

  // POST /api/v1/channels
  // Body: { platformChannelId, name, platform? }
  app.post("/channels", async (req, reply) => {
    if (!checkSecret(req, reply)) return;

    const { platformChannelId, name, platform = "YOUTUBE" } = req.body as {
      platformChannelId?: string;
      name?: string;
      platform?: string;
    };

    if (!platformChannelId || !name) {
      return reply.code(400).send({ error: "platformChannelId and name are required" });
    }

    // Get or create default tenant (MVP)
    let tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: "Default" }, select: { id: true } });
    }

    const channel = await prisma.channel.upsert({
      where: { platform_platformChannelId: { platform: platform as any, platformChannelId } },
      update: { name },
      create: {
        platform: platform as any,
        platformChannelId,
        name,
        tenantId: tenant.id,
        apiCredentialsRef: "collect",
      },
      select: { id: true, name: true, platformChannelId: true },
    });

    return channel;
  });

  // POST /api/v1/channels/invite
  // Body: { channelName, mcnId }
  app.post("/channels/invite", async (req, reply) => {
    if (!checkSecret(req, reply)) return;

    const { channelName, mcnId = "default-mcn" } = req.body as {
      channelName?: string;
      mcnId?: string;
    };

    if (!channelName) {
      return reply.code(400).send({ error: "channelName is required" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.channelInvite.create({
      data: { mcnId, channelName, token, expiresAt },
      select: { id: true, token: true, expiresAt: true },
    });

    return { inviteUrl: `https://commentguard.io/invite/${invite.token}`, ...invite };
  });

  // GET /api/v1/channels/invite/:token
  app.get("/channels/invite/:token", async (req, reply) => {
    if (!checkSecret(req, reply)) return;

    const { token } = req.params as { token: string };
    const invite = await prisma.channelInvite.findUnique({
      where: { token },
      select: { id: true, channelName: true, status: true, expiresAt: true },
    });

    if (!invite) return reply.code(404).send({ error: "Invite not found" });

    const isExpired = invite.expiresAt < new Date();
    return { ...invite, isExpired };
  });

  // POST /api/v1/channels/invite/:token/accept
  // Body: { platformChannelId, channelName }
  app.post("/channels/invite/:token/accept", async (req, reply) => {
    if (!checkSecret(req, reply)) return;

    const { token } = req.params as { token: string };
    const { platformChannelId, channelName } = req.body as {
      platformChannelId?: string;
      channelName?: string;
    };

    const invite = await prisma.channelInvite.findUnique({ where: { token } });
    if (!invite) return reply.code(404).send({ error: "Invite not found" });
    if (invite.status !== "PENDING") return reply.code(400).send({ error: "Invite already used" });
    if (invite.expiresAt < new Date()) {
      await prisma.channelInvite.update({ where: { token }, data: { status: "EXPIRED" } });
      return reply.code(400).send({ error: "Invite expired" });
    }

    if (!platformChannelId) return reply.code(400).send({ error: "platformChannelId is required" });

    let tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: "Default" }, select: { id: true } });
    }

    const channel = await prisma.channel.upsert({
      where: { platform_platformChannelId: { platform: "YOUTUBE", platformChannelId } },
      update: { mcnId: invite.mcnId },
      create: {
        platform: "YOUTUBE",
        platformChannelId,
        name: channelName ?? invite.channelName,
        tenantId: tenant.id,
        apiCredentialsRef: "collect",
        mcnId: invite.mcnId,
      },
      select: { id: true },
    });

    await prisma.channelInvite.update({ where: { token }, data: { status: "ACCEPTED" } });

    return { channelId: channel.id };
  });
}

// DEV ONLY — remove before GA
export async function devChannelsRoute(app: FastifyInstance) {
  if (process.env.NODE_ENV !== "development") {
    app.post("/channel-register", async (_req, reply) => reply.code(404).send());
    return;
  }

  // POST /api/dev/channel-register
  // Body: { channelUrl }
  // 1. Ask Python to extract channel info
  // 2. Create Channel record
  // 3. Trigger Phase-1 collect (DEV_MAX_VIDEOS limited by env)
  app.post("/channel-register", async (req, reply) => {
    const { channelUrl } = req.body as { channelUrl?: string };
    if (!channelUrl) return reply.code(400).send({ error: "channelUrl is required" });

    // Step 1: extract channel info from Python
    let platformChannelId: string;
    let channelName: string;
    try {
      const infoRes = await fetch(`${CLASSIFIER_URL}/dev/channel-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_url: channelUrl }),
      });
      if (!infoRes.ok) {
        const err = await infoRes.json().catch(() => ({})) as any;
        return reply.code(502).send({ error: err.detail ?? "Failed to extract channel info" });
      }
      const info = await infoRes.json() as { platform_channel_id: string; channel_name: string };
      platformChannelId = info.platform_channel_id;
      channelName = info.channel_name;
    } catch (e) {
      return reply.code(502).send({ error: String(e) });
    }

    // Step 2: create Channel record
    let tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: "Default" }, select: { id: true } });
    }

    const channel = await prisma.channel.upsert({
      where: { platform_platformChannelId: { platform: "YOUTUBE", platformChannelId } },
      update: { name: channelName },
      create: {
        platform: "YOUTUBE",
        platformChannelId,
        name: channelName,
        tenantId: tenant.id,
        apiCredentialsRef: "collect",
      },
      select: { id: true, name: true, platformChannelId: true },
    });

    // Step 3: create CollectJob + trigger Phase-1 collect
    const job = await prisma.collectJob.create({ data: { channelId: channel.id } });

    try {
      const collectRes = await fetch(`${CLASSIFIER_URL}/api/v1/collect/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          channel_id: channelUrl,
          callback_url: BFF_CALLBACK_URL,
        }),
      });
      if (!collectRes.ok) throw new Error(`classifier returned ${collectRes.status}`);
    } catch (e) {
      await prisma.collectJob.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: "Failed to reach classifier service" },
      });
      return reply.code(502).send({ error: "Failed to start collection" });
    }

    await prisma.collectJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });

    return { channelId: channel.id, channelName: channel.name, jobId: job.id };
  });
}

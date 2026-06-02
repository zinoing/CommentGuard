// CHECKLIST §8: quota usage is tracked per API credential account
// YouTube Data API v3 free tier: 10,000 units/day per project

import { createClient } from "redis";

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
    await redisClient.connect();
  }
  return redisClient;
}

const YOUTUBE_DAILY_QUOTA_LIMIT = Number(process.env.YOUTUBE_QUOTA_LIMIT ?? 9000); // leave 10% buffer

function quotaKey(credentialRef: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `quota:youtube:${credentialRef}:${today}`;
}

export async function consumeQuota(
  credentialRef: string,
  units: number
): Promise<void> {
  const redis = await getRedis();
  const key = quotaKey(credentialRef);

  const current = Number(await redis.get(key) ?? 0);

  if (current + units > YOUTUBE_DAILY_QUOTA_LIMIT) {
    throw new QuotaExceededError(credentialRef, current, YOUTUBE_DAILY_QUOTA_LIMIT);
  }

  await redis.incrBy(key, units);
  // TTL: expire at end of day (86400 seconds max)
  await redis.expire(key, 86400);
}

export async function getRemainingQuota(credentialRef: string): Promise<number> {
  const redis = await getRedis();
  const current = Number(await redis.get(quotaKey(credentialRef)) ?? 0);
  return YOUTUBE_DAILY_QUOTA_LIMIT - current;
}

export class QuotaExceededError extends Error {
  constructor(credentialRef: string, used: number, limit: number) {
    super(`YouTube API quota exceeded for credential ${credentialRef}: ${used}/${limit} units used`);
    this.name = "QuotaExceededError";
  }
}

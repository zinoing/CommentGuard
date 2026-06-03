// CHECKLIST §8: quota usage is tracked per API credential account
// Phase 1: in-memory tracking (resets on restart — acceptable for single-server Phase 1)
// Phase 3+: replace with Redis for persistence across restarts and horizontal scaling

const YOUTUBE_DAILY_QUOTA_LIMIT = Number(process.env.YOUTUBE_QUOTA_LIMIT ?? 9000);

const quotaStore = new Map<string, number>();

function quotaKey(credentialRef: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${credentialRef}:${today}`;
}

export async function consumeQuota(credentialRef: string, units: number): Promise<void> {
  const key = quotaKey(credentialRef);
  const current = quotaStore.get(key) ?? 0;

  if (current + units > YOUTUBE_DAILY_QUOTA_LIMIT) {
    throw new QuotaExceededError(credentialRef, current, YOUTUBE_DAILY_QUOTA_LIMIT);
  }

  quotaStore.set(key, current + units);
}

export async function getRemainingQuota(credentialRef: string): Promise<number> {
  const current = quotaStore.get(quotaKey(credentialRef)) ?? 0;
  return YOUTUBE_DAILY_QUOTA_LIMIT - current;
}

export class QuotaExceededError extends Error {
  constructor(credentialRef: string, used: number, limit: number) {
    super(`YouTube API quota exceeded for credential ${credentialRef}: ${used}/${limit} units used`);
    this.name = "QuotaExceededError";
  }
}

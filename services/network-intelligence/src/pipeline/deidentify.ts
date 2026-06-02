// CHECKLIST §7: de-identification runs before any cross-channel computation
// Raw comment content is NEVER written to the aggregate store

export interface DeidentifiedEvent {
  // No comment text, no authorPlatformId, no channelId
  patternSignals: string[];
  riskTypes: string[];
  urgencyScore: number;
  timeWindowBucket: string; // e.g. "2026-06-03T14:00:00Z" (hourly bucket)
}

export function deidentify(
  commentId: string,
  riskTypes: string[],
  urgencyScore: number,
  patternSignals: string[],
  createdAt: Date
): DeidentifiedEvent {
  // Strip all identifiers — only signal types and aggregate scores remain
  return {
    patternSignals,
    riskTypes,
    urgencyScore,
    timeWindowBucket: toHourlyBucket(createdAt),
  };
}

function toHourlyBucket(date: Date): string {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

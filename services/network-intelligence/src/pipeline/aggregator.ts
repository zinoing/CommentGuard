import { prisma, assertKAnonymity, K_ANONYMITY_MIN_CHANNELS } from "@commentguard/db";
import { DeidentifiedEvent } from "./deidentify";

interface ChannelSignalBuffer {
  channelIds: Set<string>; // only used in-memory during aggregation — never persisted
  events: DeidentifiedEvent[];
}

const buffer = new Map<string, ChannelSignalBuffer>();

export function bufferEvent(
  channelId: string,
  patternType: string,
  event: DeidentifiedEvent
): void {
  // channelId is used only for k-anonymity counting — never written to DB
  const key = `${patternType}:${event.timeWindowBucket}`;
  const existing = buffer.get(key) ?? { channelIds: new Set(), events: [] };
  existing.channelIds.add(channelId);
  existing.events.push(event);
  buffer.set(key, existing);
}

// CHECKLIST §7: only write aggregate when ≥50 distinct channels contributed
export async function flushAggregates(
  patternType: string,
  timeWindowStart: Date,
  timeWindowEnd: Date
): Promise<void> {
  const key = `${patternType}:${timeWindowStart.toISOString()}`;
  const entry = buffer.get(key);
  if (!entry) return;

  const distinctChannelCount = entry.channelIds.size;

  try {
    assertKAnonymity(distinctChannelCount);
  } catch {
    // Not enough channels yet — do not write
    return;
  }

  // CHECKLIST §7: output contains no channel-level or author-level fields
  await prisma.networkPattern.create({
    data: {
      patternType,
      occurrenceCount: entry.events.length,
      distinctChannelCount,
      timeWindowStart,
      timeWindowEnd,
      // metadata contains only aggregate statistics — no IDs
      metadata: {
        avgUrgencyScore:
          entry.events.reduce((sum, e) => sum + e.urgencyScore, 0) / entry.events.length,
        topRiskTypes: getTopRiskTypes(entry.events),
      },
    },
  });

  buffer.delete(key);
}

function getTopRiskTypes(events: DeidentifiedEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    for (const rt of e.riskTypes) {
      counts.set(rt, (counts.get(rt) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([rt]) => rt);
}

export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Case status transition rules (CHECKLIST §2)
export const CASE_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["PACKAGED"],
  PACKAGED: ["REFERRED"],
  REFERRED: ["CLOSED"],
  CLOSED: [],
};

export function isCaseTransitionAllowed(from: string, to: string): boolean {
  return CASE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// CHECKLIST §5,§7: k-anonymity guard — pattern only written when ≥50 distinct channels
export const K_ANONYMITY_MIN_CHANNELS = 50;

export function assertKAnonymity(distinctChannelCount: number): void {
  if (distinctChannelCount < K_ANONYMITY_MIN_CHANNELS) {
    throw new Error(
      `k-anonymity violation: distinctChannelCount=${distinctChannelCount} is below minimum of ${K_ANONYMITY_MIN_CHANNELS}`
    );
  }
}

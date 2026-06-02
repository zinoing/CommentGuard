import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

// CHECKLIST §7: aggregate is only surfaced via the Network Intelligence API — never directly from the DB
export async function aggregateRoute(app: FastifyInstance) {
  app.get("/patterns", async (req) => {
    const { from, to, patternType } = req.query as {
      from?: string;
      to?: string;
      patternType?: string;
    };

    const patterns = await prisma.networkPattern.findMany({
      where: {
        ...(patternType ? { patternType } : {}),
        ...(from || to
          ? {
              timeWindowStart: {
                ...(from ? { gte: new Date(from) } : {}),
              },
              timeWindowEnd: {
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { timeWindowStart: "desc" },
      take: 100,
    });

    // CHECKLIST §7: verify output contains no channel-level or author-level fields
    return patterns.map((p) => ({
      id: p.id,
      patternType: p.patternType,
      occurrenceCount: p.occurrenceCount,
      distinctChannelCount: p.distinctChannelCount,
      timeWindowStart: p.timeWindowStart,
      timeWindowEnd: p.timeWindowEnd,
      metadata: p.metadata,
      createdAt: p.createdAt,
      // explicitly omitting: channelId, authorId, mcnId
    }));
  });
}

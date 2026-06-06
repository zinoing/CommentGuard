import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import { requireRole } from "../plugins/rbac";

export async function dashboardRoute(app: FastifyInstance) {
  app.addHook("preHandler", async (req, _reply) => {
    await req.jwtVerify();
  });

  app.get(
    "/stats",
    { preHandler: requireRole("SUPER_ADMIN", "CHANNEL_MANAGER", "VIEWER") },
    async (req) => {
      const tenantId = req.user.tenantId;
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [totalComments, highRiskCount, byRiskType, dailyCounts] = await Promise.all([
        prisma.comment.count({ where: { channel: { tenantId } } }),

        prisma.riskAssessment.count({
          where: {
            comment: { channel: { tenantId } },
            legalScore: { gte: 0.7 },
          },
        }),

        prisma.riskAssessment.findMany({
          where: { comment: { channel: { tenantId } } },
          select: { riskTypes: true },
        }),

        // 7-day daily comment volume
        prisma.comment.groupBy({
          by: ["createdAt"],
          where: { channel: { tenantId }, createdAt: { gte: since7d } },
          _count: { id: true },
        }),
      ]);

      // Flatten risk type counts
      const riskTypeCounts: Record<string, number> = {};
      for (const ra of byRiskType) {
        for (const rt of ra.riskTypes) {
          riskTypeCounts[rt] = (riskTypeCounts[rt] ?? 0) + 1;
        }
      }

      // Aggregate daily counts into YYYY-MM-DD buckets
      const dailyMap: Record<string, number> = {};
      for (const row of dailyCounts) {
        const day = new Date(row.createdAt).toISOString().slice(0, 10);
        dailyMap[day] = (dailyMap[day] ?? 0) + row._count.id;
      }
      const trend = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      return {
        totalComments,
        highRiskCount,
        riskTypeCounts,
        trend,
        classification: "reference_only" as const,
      };
    }
  );
}

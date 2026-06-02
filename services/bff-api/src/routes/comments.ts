import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import { requireRole } from "../plugins/rbac";

export async function commentsRoute(app: FastifyInstance) {
  // Auth required on all routes (CHECKLIST §6)
  app.addHook("preHandler", (app as any).authenticate);

  app.get(
    "/",
    {
      preHandler: requireRole("SUPER_ADMIN", "CHANNEL_MANAGER", "VIEWER"),
    },
    async (req, reply) => {
      const { page = 1, limit = 50 } = req.query as { page?: number; limit?: number };

      const comments = await prisma.comment.findMany({
        where: {
          channel: { tenantId: req.user.tenantId },
        },
        include: {
          riskAssessments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      // CHECKLIST §6: never include raw comment data outside subscriber's own scope
      return comments.map((c) => ({
        id: c.id,
        channelId: c.channelId,
        createdAt: c.createdAt,
        riskAssessment: c.riskAssessments[0]
          ? {
              legalScore: c.riskAssessments[0].legalScore,
              brandScore: c.riskAssessments[0].brandScore,
              urgencyScore: c.riskAssessments[0].urgencyScore,
              recommendedAction: c.riskAssessments[0].recommendedAction,
              riskTypes: c.riskAssessments[0].riskTypes,
              modelVersion: c.riskAssessments[0].modelVersion,
              // CHECKLIST §3: always include classification label
              classification: "reference_only" as const,
              isProvisional: c.riskAssessments[0].isProvisional,
            }
          : null,
      }));
    }
  );
}

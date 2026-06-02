import { FastifyInstance } from "fastify";
import { prisma, isCaseTransitionAllowed } from "@commentguard/db";
import { requireRole } from "../plugins/rbac";

export async function casesRoute(app: FastifyInstance) {
  app.addHook("preHandler", (app as any).authenticate);

  app.get(
    "/",
    { preHandler: requireRole("SUPER_ADMIN", "CHANNEL_MANAGER", "VIEWER") },
    async (req) => {
      return prisma.case.findMany({
        where: { createdBy: { tenantId: req.user.tenantId } },
        include: { _count: { select: { evidencePackages: true, custodyLogs: true } } },
        orderBy: { createdAt: "desc" },
      });
    }
  );

  app.post(
    "/",
    { preHandler: requireRole("SUPER_ADMIN", "CHANNEL_MANAGER") },
    async (req, reply) => {
      const { title } = req.body as { title: string };
      const newCase = await prisma.case.create({
        data: { title, createdById: req.user.id },
      });
      return reply.code(201).send(newCase);
    }
  );

  app.patch(
    "/:id/status",
    { preHandler: requireRole("SUPER_ADMIN", "CHANNEL_MANAGER") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { newStatus } = req.body as { newStatus: string };

      const existing = await prisma.case.findUniqueOrThrow({ where: { id } });

      // Enforce lifecycle: no skipping, no reversals (CHECKLIST §2)
      if (!isCaseTransitionAllowed(existing.status, newStatus)) {
        return reply.code(422).send({
          error: `Invalid status transition: ${existing.status} → ${newStatus}`,
        });
      }

      const updated = await prisma.case.update({
        where: { id },
        data: { status: newStatus as any },
      });

      // Append custody log entry for the transition
      await prisma.custodyLog.create({
        data: {
          caseId: id,
          actorId: req.user.id,
          action: `STATUS_TRANSITION:${existing.status}→${newStatus}`,
          ipAddress: req.ip,
        },
      });

      return updated;
    }
  );
}

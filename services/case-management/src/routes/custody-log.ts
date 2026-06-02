import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

// CHECKLIST §2: custody log is append-only
// This service NEVER issues UPDATE or DELETE on custody_log table

export async function custodyLogRoute(app: FastifyInstance) {
  app.get("/cases/:caseId/custody-log", async (req) => {
    const { caseId } = req.params as { caseId: string };
    return prisma.custodyLog.findMany({
      where: { caseId },
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  });

  // Append only: POST creates entries, no PUT/PATCH/DELETE routes exist
  app.post("/cases/:caseId/custody-log", async (req, reply) => {
    const { caseId } = req.params as { caseId: string };
    const { actorId, action, ipAddress, metadata } = req.body as {
      actorId: string;
      action: string;
      ipAddress: string;
      metadata?: Record<string, unknown>;
    };

    const entry = await prisma.custodyLog.create({
      data: { caseId, actorId, action, ipAddress, metadata },
    });

    return reply.code(201).send(entry);
  });
}

import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

// CHECKLIST §3: no code path executes a platform action without approved_by being set
// CHECKLIST §3: no scheduled job or background worker can trigger platform actions autonomously

export async function actionsRoute(app: FastifyInstance) {
  // Create pending action (no execution here)
  app.post("/", async (req, reply) => {
    const { commentId, actionType } = req.body as { commentId: string; actionType: string };

    const action = await prisma.action.create({
      data: {
        commentId,
        actionType: actionType as any,
        status: "PENDING",
        // approved_by intentionally NOT set here - requires separate approval step
      },
    });

    return reply.code(201).send(action);
  });

  // Approve and execute action
  app.post("/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { approvedById } = req.body as { approvedById: string };

    if (!approvedById) {
      return reply.code(400).send({ error: "approvedById is required" });
    }

    // CHECKLIST §3: approved_by must be a real user ID, never system/bot
    const approver = await prisma.user.findUnique({ where: { id: approvedById } });
    if (!approver) {
      return reply.code(400).send({ error: "approvedById must be a valid user ID" });
    }

    // Guard against system-level IDs
    const SYSTEM_IDS = ["system", "bot", "auto", "scheduler"];
    if (SYSTEM_IDS.includes(approvedById.toLowerCase())) {
      return reply.code(403).send({ error: "Platform actions cannot be approved by system accounts" });
    }

    const action = await prisma.action.findUniqueOrThrow({
      where: { id },
      include: { comment: { include: { channel: true } } },
    });

    if (action.status !== "PENDING") {
      return reply.code(422).send({ error: `Action is already ${action.status}` });
    }

    // Set approved_by and approved_at (CHECKLIST §3)
    const updatedAction = await prisma.action.update({
      where: { id },
      data: {
        approvedById,
        approvedAt: new Date(),
        status: "APPROVED",
      },
    });

    // Execute platform action
    try {
      await executePlatformAction(action);
      await prisma.action.update({
        where: { id },
        data: { status: "EXECUTED", executedAt: new Date() },
      });
    } catch (err) {
      await prisma.action.update({
        where: { id },
        data: { status: "FAILED", platformResponse: { error: String(err) } },
      });
      return reply.code(502).send({ error: "Platform action execution failed" });
    }

    return updatedAction;
  });
}

async function executePlatformAction(action: any) {
  // Platform API call (YouTube hide/delete)
  // Production: use official YouTube Data API v3 within official permissions (CHECKLIST §8)
  console.log(`Executing ${action.actionType} on comment ${action.commentId}`);
}

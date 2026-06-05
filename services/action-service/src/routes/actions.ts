import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";

// CHECKLIST §3: CommentGuard supports exactly one action type: REQUEST_LEGAL_REVIEW
// No code path calls platform delete/hide/block APIs — operator acts on the platform directly.
// CHECKLIST §3: no scheduled job or background worker can trigger platform actions autonomously.

const ALLOWED_ACTION_TYPES = new Set(["REQUEST_LEGAL_REVIEW"]);
const SYSTEM_IDS = new Set(["system", "bot", "auto", "scheduler"]);

export async function actionsRoute(app: FastifyInstance) {
  // Create pending action
  app.post("/", async (req, reply) => {
    const { commentId, actionType } = req.body as { commentId: string; actionType: string };

    if (!ALLOWED_ACTION_TYPES.has(actionType)) {
      return reply.code(400).send({
        error: `actionType must be REQUEST_LEGAL_REVIEW. CommentGuard does not perform platform hide/delete/block actions.`,
      });
    }

    const action = await prisma.action.create({
      data: {
        commentId,
        actionType: "REQUEST_LEGAL_REVIEW",
        status: "PENDING",
        // approvedBy intentionally NOT set here — requires separate approval step
      },
    });

    return reply.code(201).send(action);
  });

  // Approve and execute legal review request
  app.post("/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { approvedById } = req.body as { approvedById: string };

    if (!approvedById) {
      return reply.code(400).send({ error: "approvedById is required" });
    }

    // CHECKLIST §3: approved_by must be a real user ID, never system/bot
    if (SYSTEM_IDS.has(approvedById.toLowerCase())) {
      return reply.code(403).send({ error: "Actions cannot be approved by system accounts" });
    }

    const approver = await prisma.user.findUnique({ where: { id: approvedById } });
    if (!approver) {
      return reply.code(400).send({ error: "approvedById must be a valid user ID" });
    }

    const action = await prisma.action.findUniqueOrThrow({ where: { id } });

    if (action.status !== "PENDING") {
      return reply.code(422).send({ error: `Action is already ${action.status}` });
    }

    if (action.actionType !== "REQUEST_LEGAL_REVIEW") {
      return reply.code(400).send({ error: "Only REQUEST_LEGAL_REVIEW actions can be approved" });
    }

    await prisma.action.update({
      where: { id },
      data: { approvedById, approvedAt: new Date(), status: "APPROVED" },
    });

    // Activate Legal Hold on the comment
    await prisma.comment.update({
      where: { id: action.commentId },
      data: { legalHoldActive: true, legalHoldActivatedAt: new Date() },
    });

    const executed = await prisma.action.update({
      where: { id },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        platformResponse: { legalHoldActivated: true },
      },
    });

    return executed;
  });

  // List actions for a comment
  app.get("/comment/:commentId", async (req) => {
    const { commentId } = req.params as { commentId: string };
    return prisma.action.findMany({
      where: { commentId },
      orderBy: { createdAt: "desc" },
    });
  });
}

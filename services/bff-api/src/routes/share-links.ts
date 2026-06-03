import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import crypto from "crypto";
import { requireRole } from "../plugins/rbac";

const ANOMALY_ACCESS_THRESHOLD = 10;
const ANOMALY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function shareLinksRoute(app: FastifyInstance) {
  // Create share link (law firm portal)
  app.post(
    "/",
    {
      preHandler: [
        (app as any).authenticate,
        requireRole("SUPER_ADMIN", "CHANNEL_MANAGER"),
      ],
    },
    async (req, reply) => {
      const { caseId, expiresAt } = req.body as { caseId: string; expiresAt: string };

      if (!expiresAt) {
        return reply.code(400).send({ error: "expiresAt is required - non-expiring tokens are not allowed" });
      }

      // Cryptographic token (CHECKLIST §4)
      const token = crypto.randomBytes(32).toString("hex");

      const shareLink = await prisma.shareLink.create({
        data: {
          caseId,
          token,
          expiresAt: new Date(expiresAt),
        },
      });

      await prisma.custodyLog.create({
        data: {
          caseId,
          actorId: req.user.id,
          action: "SHARE_LINK_CREATED",
          ipAddress: req.ip,
          metadata: { shareLinkId: shareLink.id },
        },
      });

      return reply.code(201).send({ id: shareLink.id, token, expiresAt: shareLink.expiresAt });
    }
  );

  // Access share link (read-only, law firm role)
  // CHECKLIST §4: only GET methods allowed
  app.get("/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const userAgent = req.headers["user-agent"] ?? "unknown";

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: { case: { include: { evidencePackages: true } } },
    });

    const isValid =
      !!shareLink &&
      !shareLink.isRevoked &&
      new Date(shareLink.expiresAt) > new Date();

    // Log every access attempt (CHECKLIST §4)
    if (shareLink) {
      await prisma.shareLinkAccess.create({
        data: {
          shareLinkId: shareLink.id,
          ipAddress: req.ip,
          userAgent,
          wasValid: isValid,
        },
      });

      // Anomaly detection: >10 accesses/hour → auto-revoke (CHECKLIST §4)
      if (isValid) {
        const recentAccesses = await prisma.shareLinkAccess.count({
          where: {
            shareLinkId: shareLink.id,
            accessedAt: { gte: new Date(Date.now() - ANOMALY_WINDOW_MS) },
          },
        });

        if (recentAccesses > ANOMALY_ACCESS_THRESHOLD) {
          await prisma.shareLink.update({
            where: { id: shareLink.id },
            data: { isRevoked: true, revokedAt: new Date() },
          });
          return reply.code(429).send({ error: "Link revoked due to anomalous access pattern" });
        }
      }
    }

    if (!isValid) {
      return reply.code(404).send({ error: "Share link not found or expired" });
    }

    return {
      case: {
        id: shareLink.case.id,
        title: shareLink.case.title,
        status: shareLink.case.status,
      },
      evidencePackages: shareLink.case.evidencePackages.map((ep) => ({
        id: ep.id,
        pdfR2Key: ep.pdfR2Key,
        checksum: ep.checksum,
        checksumAlg: ep.checksumAlg,
        createdAt: ep.createdAt,
      })),
    };
  });

  // Revoke share link (immediate, no cache)
  app.delete(
    "/:id/revoke",
    {
      preHandler: [
        (app as any).authenticate,
        requireRole("SUPER_ADMIN", "CHANNEL_MANAGER"),
      ],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      await prisma.shareLink.update({
        where: { id },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      await prisma.custodyLog.create({
        data: {
          caseId: (await prisma.shareLink.findUniqueOrThrow({ where: { id } })).caseId,
          actorId: req.user.id,
          action: "SHARE_LINK_REVOKED",
          ipAddress: req.ip,
          metadata: { shareLinkId: id },
        },
      });

      return reply.code(204).send();
    }
  );
}

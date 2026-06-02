import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import { generateEvidencePDF } from "../pdf/generator";
import { readAndVerifySnapshot, SnapshotHashMismatchError } from "../s3/snapshot";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-northeast-2",
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: !!process.env.AWS_ENDPOINT_URL,
});

export async function evidenceRoute(app: FastifyInstance) {
  // CHECKLIST §1: hash verified on every read
  app.get("/snapshots/:commentId", async (req, reply) => {
    const { commentId } = req.params as { commentId: string };

    const comment = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });

    try {
      const data = await readAndVerifySnapshot(comment.snapshotS3Key, comment.snapshotHash);
      return { commentId, data, hashVerified: true };
    } catch (err) {
      if (err instanceof SnapshotHashMismatchError) {
        app.log.error({ commentId, s3Key: comment.snapshotS3Key }, "INTEGRITY VIOLATION: snapshot hash mismatch");
        return reply.code(500).send({ error: "Evidence integrity check failed — hash mismatch detected" });
      }
      throw err;
    }
  });

  app.post("/generate", async (req, reply) => {
    // CHECKLIST §2: case_id is required (no orphaned packages)
    const { caseId, commentIds } = req.body as { caseId: string; commentIds: string[] };

    if (!caseId) {
      return reply.code(400).send({ error: "caseId is required" });
    }

    const pdfBuffer = await generateEvidencePDF(caseId, commentIds);
    const checksum = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const s3Key = `evidence/${caseId}/${Date.now()}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_EVIDENCE_BUCKET!,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );

    // CHECKLIST §2: case_id is required field on EvidencePackage
    const pkg = await prisma.evidencePackage.create({
      data: {
        caseId,
        pdfS3Key: s3Key,
        checksum,
        checksumAlg: "sha256",
        createdById: (req as any).user?.id ?? "system",
      },
    });

    await prisma.custodyLog.create({
      data: {
        caseId,
        actorId: (req as any).user?.id ?? "system",
        action: "EVIDENCE_PACKAGE_CREATED",
        ipAddress: req.ip,
        metadata: { packageId: pkg.id, checksum },
      },
    });

    return reply.code(201).send({ id: pkg.id, checksum, s3Key });
  });
}

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

const BUCKET = process.env.S3_EVIDENCE_BUCKET!;

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
    const { caseId, commentIds, createdById } = req.body as {
      caseId: string;
      commentIds: string[];
      createdById: string;
    };

    if (!caseId) return reply.code(400).send({ error: "caseId is required" });
    if (!createdById) return reply.code(400).send({ error: "createdById is required" });

    // Verify createdById is a real user (CHECKLIST §3)
    const creator = await prisma.user.findUnique({ where: { id: createdById } });
    if (!creator) return reply.code(400).send({ error: "createdById must be a valid user ID" });

    const pdfBuffer = await generateEvidencePDF(caseId, commentIds);
    const checksum = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

    const pdfS3Key = `evidence/${caseId}/${Date.now()}.pdf`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: pdfS3Key, Body: pdfBuffer, ContentType: "application/pdf" }));

    // CHECKLIST §1: custody log stored immutably in S3 (custodyLogS3Key)
    const custodyLogs = await prisma.custodyLog.findMany({
      where: { caseId },
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const custodyLogPayload = JSON.stringify(custodyLogs);
    const custodyLogS3Key = `evidence/${caseId}/custody-log-${Date.now()}.json`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: custodyLogS3Key, Body: custodyLogPayload, ContentType: "application/json" }));

    // CHECKLIST §2: case_id required, no orphaned packages
    const pkg = await prisma.evidencePackage.create({
      data: {
        caseId,
        pdfS3Key,
        custodyLogS3Key,
        timelinePageIncluded: true,
        checksum,
        checksumAlg: "sha256",
        createdById,
      },
    });

    await prisma.custodyLog.create({
      data: {
        caseId,
        actorId: createdById,
        action: "EVIDENCE_PACKAGE_CREATED",
        ipAddress: req.ip,
        metadata: { packageId: pkg.id, checksum, pdfS3Key, custodyLogS3Key },
      },
    });

    return reply.code(201).send({ id: pkg.id, checksum, pdfS3Key, custodyLogS3Key });
  });

  // List evidence packages for a case
  app.get("/packages/:caseId", async (req) => {
    const { caseId } = req.params as { caseId: string };
    return prisma.evidencePackage.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });
  });
}

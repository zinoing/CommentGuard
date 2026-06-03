import { FastifyInstance } from "fastify";
import { prisma } from "@commentguard/db";
import { generateEvidencePDF } from "../pdf/generator";
import { readAndVerifySnapshot, SnapshotHashMismatchError } from "../s3/snapshot";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function evidenceRoute(app: FastifyInstance) {
  // CHECKLIST §1: hash verified on every read
  app.get("/snapshots/:commentId", async (req, reply) => {
    const { commentId } = req.params as { commentId: string };

    const comment = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });

    try {
      const data = await readAndVerifySnapshot(comment.snapshotR2Key, comment.snapshotHash);
      return { commentId, data, hashVerified: true };
    } catch (err) {
      if (err instanceof SnapshotHashMismatchError) {
        app.log.error({ commentId, r2Key: comment.snapshotR2Key }, "INTEGRITY VIOLATION: snapshot hash mismatch");
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

    const pdfR2Key = `evidence/${caseId}/${Date.now()}.pdf`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: pdfR2Key, Body: pdfBuffer, ContentType: "application/pdf" }));

    // CHECKLIST §1: custody log stored immutably in R2 (custodyLogR2Key)
    const custodyLogs = await prisma.custodyLog.findMany({
      where: { caseId },
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const custodyLogPayload = JSON.stringify(custodyLogs);
    const custodyLogR2Key = `evidence/${caseId}/custody-log-${Date.now()}.json`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: custodyLogR2Key, Body: custodyLogPayload, ContentType: "application/json" }));

    // CHECKLIST §2: case_id required, no orphaned packages
    const pkg = await prisma.evidencePackage.create({
      data: {
        caseId,
        pdfR2Key,
        custodyLogR2Key,
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
        metadata: { packageId: pkg.id, checksum, pdfR2Key, custodyLogR2Key },
      },
    });

    return reply.code(201).send({ id: pkg.id, checksum, pdfR2Key, custodyLogR2Key });
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

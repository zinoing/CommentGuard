import PDFDocument from "pdfkit";
import crypto from "crypto";
import { prisma } from "@commentguard/db";

// CHECKLIST §1: EvidencePackage PDF includes timeline, chain of custody, checksum, legal statutes
export async function generateEvidencePDF(caseId: string, commentIds: string[]): Promise<Buffer> {
  const [caseData, comments, custodyLogs] = await Promise.all([
    prisma.case.findUniqueOrThrow({ where: { id: caseId } }),
    prisma.comment.findMany({
      where: { id: { in: commentIds } },
      include: { riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.custodyLog.findMany({
      where: { caseId },
      include: { actor: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // === Page 1: Incident Timeline ===
    doc.fontSize(20).text("EVIDENCE PACKAGE", { align: "center" });
    doc.fontSize(14).text(`Case ID: ${caseId}`, { align: "center" });
    doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.addPage();

    doc.fontSize(16).text("INCIDENT TIMELINE");
    doc.moveDown();
    for (const comment of comments) {
      const ra = comment.riskAssessments[0];
      doc.fontSize(10).text(`[${comment.createdAt.toISOString()}] Comment ID: ${comment.id}`);
      if (ra) {
        doc.text(`  Legal Score: ${ra.legalScore} | Classification: ${ra.classification}`);
        doc.text(`  Risk Types: ${ra.riskTypes.join(", ")}`);
      }
      doc.moveDown(0.5);
    }

    // === Page 2: Chain of Custody Log ===
    doc.addPage();
    doc.fontSize(16).text("CHAIN OF CUSTODY");
    doc.moveDown();
    for (const log of custodyLogs) {
      doc.fontSize(10).text(
        `[${log.createdAt.toISOString()}] Actor: ${log.actor.email} | Action: ${log.action} | IP: ${log.ipAddress}`
      );
    }

    // === Page 3: Checksum Block ===
    doc.addPage();
    doc.fontSize(16).text("CHECKSUM VERIFICATION");
    doc.moveDown();
    for (const comment of comments) {
      doc.fontSize(10).text(`Comment ${comment.id}:`);
      doc.text(`  Hash: ${comment.snapshotHash}`);
      doc.text(`  Algorithm: ${comment.snapshotHashAlg}`);
      doc.text(`  Timestamp: ${comment.createdAt.toISOString()}`);
      doc.moveDown(0.5);
    }

    // === Legal Statute References ===
    doc.addPage();
    doc.fontSize(16).text("APPLICABLE LEGAL STATUTE REFERENCES");
    doc.moveDown();
    doc.fontSize(10).text("형법 제283조 (협박죄) — Criminal Act Article 283 (Intimidation)");
    doc.text("형법 제307조 (명예훼손죄) — Criminal Act Article 307 (Defamation)");
    doc.text("정보통신망법 제44조의7 (불법정보의 유통금지)");
    doc.text("개인정보보호법 (PIPA) — Personal Information Protection Act");
    doc.moveDown();
    doc.fontSize(8).text(
      "DISCLAIMER: This evidence package is for reference only and does not constitute a legal determination."
    );

    doc.end();
  });
}

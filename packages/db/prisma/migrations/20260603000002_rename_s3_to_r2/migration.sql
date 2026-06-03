-- Rename S3 fields to R2 to reflect Cloudflare R2 as the storage backend (Plan v2.2)
-- CHECKLIST §5: new migration — existing migrations are never modified

-- Comment: snapshotS3Key → snapshotR2Key
ALTER TABLE "Comment" RENAME COLUMN "snapshotS3Key" TO "snapshotR2Key";

-- EvidencePackage: pdfS3Key → pdfR2Key, custodyLogS3Key → custodyLogR2Key
ALTER TABLE "EvidencePackage" RENAME COLUMN "pdfS3Key" TO "pdfR2Key";
ALTER TABLE "EvidencePackage" RENAME COLUMN "custodyLogS3Key" TO "custodyLogR2Key";

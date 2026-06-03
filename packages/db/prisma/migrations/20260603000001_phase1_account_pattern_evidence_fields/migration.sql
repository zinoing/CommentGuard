-- Phase 1: Add AccountPattern (MVP entity) and EvidencePackage Phase 1 fields

-- AccountPattern: account anomaly detection signals
-- ip_cluster_id is an anonymized cluster token — never a raw IP (CHECKLIST §5)
CREATE TABLE "AccountPattern" (
    "authorPlatformId" TEXT NOT NULL,
    "commentCount30d"  INTEGER NOT NULL DEFAULT 0,
    "isNewAccount"     BOOLEAN NOT NULL DEFAULT false,
    "ipClusterId"      TEXT,
    "flaggedAt"        TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPattern_pkey" PRIMARY KEY ("authorPlatformId")
);

-- EvidencePackage: add custody log S3 key and timeline page flag (CHECKLIST §1)
ALTER TABLE "EvidencePackage"
    ADD COLUMN "custodyLogS3Key"      TEXT NOT NULL DEFAULT '',
    ADD COLUMN "timelinePageIncluded" BOOLEAN NOT NULL DEFAULT false;

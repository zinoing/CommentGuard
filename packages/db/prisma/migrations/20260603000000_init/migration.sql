-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YOUTUBE', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'PACKAGED', 'REFERRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('IGNORE', 'HIDE', 'DELETE', 'PRESERVE_AND_DELETE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'CHANNEL_MANAGER', 'VIEWER', 'LAW_FIRM');

-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('LEGAL_THREAT', 'HATE_SPEECH', 'HARASSMENT', 'SPAM', 'COORDINATED_ATTACK');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformChannelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apiCredentialsRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- Immutable: no updatedAt column (CHECKLIST §5)
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "platformCommentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorPlatformId" TEXT NOT NULL,
    "snapshotS3Key" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "snapshotHashAlg" TEXT NOT NULL DEFAULT 'sha256',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- Immutable: no updatedAt column (CHECKLIST §5)
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "riskTypes" "RiskType"[],
    "legalScore" DOUBLE PRECISION NOT NULL,
    "brandScore" DOUBLE PRECISION NOT NULL,
    "urgencyScore" DOUBLE PRECISION NOT NULL,
    "recommendedAction" "ActionType" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'reference_only',
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- Action: approved_by required before execution (CHECKLIST §3)
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "platformResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- Case: lifecycle enforced in application layer (CHECKLIST §2)
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- Append-only: no updatedAt, never UPDATE or DELETE this table (CHECKLIST §2)
CREATE TABLE "CustodyLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustodyLog_pkey" PRIMARY KEY ("id")
);

-- Immutable + caseId required (no orphaned packages) (CHECKLIST §2)
CREATE TABLE "EvidencePackage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "pdfS3Key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "checksumAlg" TEXT NOT NULL DEFAULT 'sha256',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidencePackage_pkey" PRIMARY KEY ("id")
);

-- ShareLink: crypto token, expires_at required (CHECKLIST §4)
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- Log every access to share links (CHECKLIST §4)
CREATE TABLE "ShareLinkAccess" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wasValid" BOOLEAN NOT NULL,
    CONSTRAINT "ShareLinkAccess_pkey" PRIMARY KEY ("id")
);

-- k-anonymity: NO channel_id, author_id, mcn_id, or PII fields (CHECKLIST §5,§7)
-- Only written when distinctChannelCount >= 50
CREATE TABLE "NetworkPattern" (
    "id" TEXT NOT NULL,
    "patternType" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "distinctChannelCount" INTEGER NOT NULL,
    "timeWindowStart" TIMESTAMP(3) NOT NULL,
    "timeWindowEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetworkPattern_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NetworkPattern_k_anonymity" CHECK ("distinctChannelCount" >= 50)
);

-- UniqueIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Channel_platform_platformChannelId_key" ON "Channel"("platform", "platformChannelId");
CREATE UNIQUE INDEX "Comment_channelId_platformCommentId_key" ON "Comment"("channelId", "platformCommentId");
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- Indexes for query performance
CREATE INDEX "Comment_channelId_createdAt_idx" ON "Comment"("channelId", "createdAt" DESC);
CREATE INDEX "RiskAssessment_commentId_idx" ON "RiskAssessment"("commentId");
CREATE INDEX "CustodyLog_caseId_createdAt_idx" ON "CustodyLog"("caseId", "createdAt" ASC);
CREATE INDEX "ShareLinkAccess_shareLinkId_accessedAt_idx" ON "ShareLinkAccess"("shareLinkId", "accessedAt" DESC);

-- Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Case" ADD CONSTRAINT "Case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyLog" ADD CONSTRAINT "CustodyLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyLog" ADD CONSTRAINT "CustodyLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidencePackage" ADD CONSTRAINT "EvidencePackage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareLinkAccess" ADD CONSTRAINT "ShareLinkAccess_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

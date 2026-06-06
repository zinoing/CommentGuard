-- CHECKLIST §5: new migration — existing migrations are never modified

-- CreateEnum: job lifecycle for channel comment collection
CREATE TYPE "CollectJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable: tracks channel-level collection jobs
CREATE TABLE "CollectJob" (
    "id"              TEXT                NOT NULL,
    "channelId"       TEXT                NOT NULL,
    "status"          "CollectJobStatus"  NOT NULL DEFAULT 'PENDING',
    "totalVideos"     INTEGER             NOT NULL DEFAULT 0,
    "processedVideos" INTEGER             NOT NULL DEFAULT 0,
    "totalComments"   INTEGER             NOT NULL DEFAULT 0,
    "errorMessage"    TEXT,
    "createdAt"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectJob_pkey" PRIMARY KEY ("id")
);

-- Make Comment snapshot fields nullable (Phase 3 will populate them)
ALTER TABLE "Comment" ALTER COLUMN "snapshotR2Key" DROP NOT NULL;
ALTER TABLE "Comment" ALTER COLUMN "snapshotHash"  DROP NOT NULL;

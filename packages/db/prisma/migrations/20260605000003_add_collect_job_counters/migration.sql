-- CHECKLIST §5: new migration — existing migrations are never modified

-- Add delta counters to CollectJob for per-run change tracking
ALTER TABLE "CollectJob" ADD COLUMN "newComments"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CollectJob" ADD COLUMN "modifiedComments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CollectJob" ADD COLUMN "deletedComments"  INTEGER NOT NULL DEFAULT 0;

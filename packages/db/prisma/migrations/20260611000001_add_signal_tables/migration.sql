-- CHECKLIST §5: new migration — existing migrations are never modified

-- CreateTable: Ops Lane signal (reference_only)
CREATE TABLE "CommentOpsSignal" (
    "id"              TEXT             NOT NULL,
    "commentId"       TEXT             NOT NULL,
    "ruleVersion"     TEXT             NOT NULL,
    "detectedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spamFlags"       TEXT[],
    "repetitionCount" INTEGER          NOT NULL DEFAULT 0,
    "urlRatio"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opsScore"        DOUBLE PRECISION NOT NULL,
    "labels"          TEXT[],
    "classification"  TEXT             NOT NULL DEFAULT 'reference_only',
    CONSTRAINT "CommentOpsSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentOpsSignal_commentId_idx" ON "CommentOpsSignal"("commentId");

-- CreateTable: Legal Lane signal (reference_only)
CREATE TABLE "CommentLegalSignal" (
    "id"                  TEXT             NOT NULL,
    "commentId"           TEXT             NOT NULL,
    "ruleVersion"         TEXT             NOT NULL,
    "modelVersion"        TEXT             NOT NULL DEFAULT 'rule-only-v2',
    "detectedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expressionType"      TEXT             NOT NULL,
    "targetSpecificity"   TEXT             NOT NULL,
    "allegationTypes"     TEXT[],
    "assertionStrength"   INTEGER          NOT NULL,
    "evidencePresent"     BOOLEAN          NOT NULL,
    "evidenceTypes"       TEXT[],
    "extractedEntities"   TEXT[],
    "elementScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "embeddingScore"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "embeddingCategory"   TEXT,
    "nliScore"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nliHypothesis"       TEXT,
    "legalScore"          DOUBLE PRECISION NOT NULL,
    "notes"               TEXT,
    "requiresHumanReview" BOOLEAN          NOT NULL DEFAULT false,
    "classification"      TEXT             NOT NULL DEFAULT 'reference_only',
    CONSTRAINT "CommentLegalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentLegalSignal_commentId_idx" ON "CommentLegalSignal"("commentId");
CREATE INDEX "CommentLegalSignal_requiresHumanReview_idx" ON "CommentLegalSignal"("requiresHumanReview");

-- CreateTable: atomic observation labels
CREATE TABLE "CommentLabel" (
    "id"          TEXT         NOT NULL,
    "commentId"   TEXT         NOT NULL,
    "label"       TEXT         NOT NULL,
    "lane"        TEXT         NOT NULL,
    "source"      TEXT         NOT NULL,
    "ruleVersion" TEXT,
    "detectedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLabel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentLabel_commentId_idx" ON "CommentLabel"("commentId");
CREATE INDEX "CommentLabel_label_idx" ON "CommentLabel"("label");

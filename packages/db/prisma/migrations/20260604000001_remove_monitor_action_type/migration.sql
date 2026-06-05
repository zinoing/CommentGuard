-- Remove IGNORE and MONITOR from ActionType enum; keep only REQUEST_LEGAL_REVIEW.
-- Make RiskAssessment.recommendedAction nullable (null = no legal review recommended).
-- CHECKLIST §3: OPEN_ON_PLATFORM is a UI-only redirect with no DB write — not stored here.

-- Step 1: make recommendedAction nullable before type change (avoids NOT NULL constraint issues)
ALTER TABLE "RiskAssessment" ALTER COLUMN "recommendedAction" DROP NOT NULL;

-- Step 2: rename existing enum
ALTER TYPE "ActionType" RENAME TO "ActionType_old";

-- Step 3: create corrected enum (single value)
CREATE TYPE "ActionType" AS ENUM ('REQUEST_LEGAL_REVIEW');

-- Step 4: migrate RiskAssessment — non-REQUEST_LEGAL_REVIEW values become NULL
ALTER TABLE "RiskAssessment"
  ALTER COLUMN "recommendedAction" TYPE "ActionType"
  USING (
    CASE "recommendedAction"::text
      WHEN 'REQUEST_LEGAL_REVIEW' THEN 'REQUEST_LEGAL_REVIEW'
      ELSE NULL
    END
  )::"ActionType";

-- Step 5: migrate Action — only REQUEST_LEGAL_REVIEW is valid; anything else is a data error
-- (fresh dev DB should have no rows with IGNORE/MONITOR, but guard anyway)
ALTER TABLE "Action"
  ALTER COLUMN "actionType" TYPE "ActionType"
  USING (
    CASE "actionType"::text
      WHEN 'REQUEST_LEGAL_REVIEW' THEN 'REQUEST_LEGAL_REVIEW'
      ELSE 'REQUEST_LEGAL_REVIEW'
    END
  )::"ActionType";

-- Step 6: drop old enum
DROP TYPE "ActionType_old";

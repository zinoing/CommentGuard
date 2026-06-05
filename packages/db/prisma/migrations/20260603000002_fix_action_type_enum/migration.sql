-- Remove forbidden platform-action values from ActionType enum
-- CHECKLIST §3: CommentGuard only supports IGNORE / MONITOR / REQUEST_LEGAL_REVIEW
-- HIDE / DELETE / PRESERVE_AND_DELETE are never valid action types

-- Step 1: rename existing enum
ALTER TYPE "ActionType" RENAME TO "ActionType_old";

-- Step 2: create corrected enum
CREATE TYPE "ActionType" AS ENUM ('IGNORE', 'MONITOR', 'REQUEST_LEGAL_REVIEW');

-- Step 3: migrate RiskAssessment column (map old forbidden values to nearest valid)
ALTER TABLE "RiskAssessment"
  ALTER COLUMN "recommendedAction" TYPE "ActionType"
  USING (
    CASE "recommendedAction"::text
      WHEN 'HIDE'               THEN 'MONITOR'
      WHEN 'DELETE'             THEN 'REQUEST_LEGAL_REVIEW'
      WHEN 'PRESERVE_AND_DELETE' THEN 'REQUEST_LEGAL_REVIEW'
      ELSE "recommendedAction"::text
    END
  )::"ActionType";

-- Step 4: migrate Action column (same mapping)
ALTER TABLE "Action"
  ALTER COLUMN "actionType" TYPE "ActionType"
  USING (
    CASE "actionType"::text
      WHEN 'HIDE'               THEN 'MONITOR'
      WHEN 'DELETE'             THEN 'REQUEST_LEGAL_REVIEW'
      WHEN 'PRESERVE_AND_DELETE' THEN 'REQUEST_LEGAL_REVIEW'
      ELSE "actionType"::text
    END
  )::"ActionType";

-- Step 5: drop old enum
DROP TYPE "ActionType_old";

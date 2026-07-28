-- CreateEnum
CREATE TYPE "MissionKind" AS ENUM ('PLACE_VISIT', 'WALK_STEPS', 'WALK_DISTANCE', 'QUIZ', 'QR_SCAN', 'PHOTO', 'CHECK_IN', 'COMPOSITE');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "kind" "MissionKind",
ADD COLUMN     "targetUnit" VARCHAR(30),
ADD COLUMN     "targetValue" DECIMAL(12,2),
ALTER COLUMN "placeId" DROP NOT NULL;

UPDATE "Mission" SET "kind" = 'PLACE_VISIT' WHERE "kind" IS NULL;

ALTER TABLE "Mission" ALTER COLUMN "kind" SET NOT NULL;

-- AlterTable
ALTER TABLE "Verification" ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "observedValue" DECIMAL(12,2);

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_targetValue_check" CHECK ("targetValue" IS NULL OR "targetValue" > 0),
ADD CONSTRAINT "Mission_targetPair_check" CHECK (
  ("targetValue" IS NULL AND "targetUnit" IS NULL)
  OR
  ("targetValue" IS NOT NULL AND "targetUnit" IS NOT NULL)
),
ADD CONSTRAINT "Mission_placeVisitPlace_check" CHECK ("kind" <> 'PLACE_VISIT' OR "placeId" IS NOT NULL);

ALTER TABLE "Verification"
ADD CONSTRAINT "Verification_observedValue_check" CHECK ("observedValue" IS NULL OR "observedValue" >= 0);

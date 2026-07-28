-- AlterTable
ALTER TABLE "BingoSession"
ADD COLUMN "dailyDate" DATE,
ADD COLUMN "layoutVariant" INTEGER;

-- Daily sessions always carry both a date and a valid symmetry variant.
ALTER TABLE "BingoSession"
ADD CONSTRAINT "BingoSession_dailyLayoutPair_check" CHECK (
  ("dailyDate" IS NULL AND "layoutVariant" IS NULL)
  OR
  (
    "dailyDate" IS NOT NULL
    AND "layoutVariant" BETWEEN 0 AND 7
  )
);

-- A user can receive only one session for a given Daily template and date.
CREATE UNIQUE INDEX "BingoSession_userId_templateId_dailyDate_key"
ON "BingoSession"("userId", "templateId", "dailyDate");

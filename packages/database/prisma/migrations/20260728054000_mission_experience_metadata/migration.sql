ALTER TABLE "Mission"
ADD COLUMN "estimatedMinutesMin" INTEGER,
ADD COLUMN "estimatedMinutesMax" INTEGER,
ADD COLUMN "similarityGroup" VARCHAR(60);

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_estimated_minutes_check"
CHECK (
  ("estimatedMinutesMin" IS NULL OR "estimatedMinutesMin" > 0)
  AND ("estimatedMinutesMax" IS NULL OR "estimatedMinutesMax" > 0)
  AND (
    "estimatedMinutesMin" IS NULL
    OR "estimatedMinutesMax" IS NULL
    OR "estimatedMinutesMin" <= "estimatedMinutesMax"
  )
);

CREATE INDEX "Mission_similarityGroup_status_idx"
ON "Mission"("similarityGroup", "status");

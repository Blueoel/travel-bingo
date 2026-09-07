CREATE TYPE "UserReportType" AS ENUM ('USER_REPORT', 'INQUIRY');

ALTER TABLE "UserReport"
  ALTER COLUMN "reportedId" DROP NOT NULL,
  ADD COLUMN "type" "UserReportType" NOT NULL DEFAULT 'USER_REPORT',
  ADD COLUMN "subject" VARCHAR(100),
  ADD COLUMN "adminReply" VARCHAR(1000),
  ADD COLUMN "respondedAt" TIMESTAMPTZ(3);

CREATE INDEX "UserReport_type_status_createdAt_idx"
  ON "UserReport"("type", "status", "createdAt");

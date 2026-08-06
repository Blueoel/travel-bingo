CREATE TYPE "UserReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "UserBlock" (
  "id" UUID NOT NULL,
  "blockerId" UUID NOT NULL,
  "blockedId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserReport" (
  "id" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "reportedId" UUID NOT NULL,
  "reason" VARCHAR(40) NOT NULL,
  "detail" VARCHAR(500),
  "status" "UserReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");
CREATE INDEX "UserReport_reportedId_status_idx" ON "UserReport"("reportedId", "status");
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DailyOperation" (
  "id" UUID NOT NULL,
  "cycleDate" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  "templateId" UUID,
  "rankingEntryCount" INTEGER NOT NULL DEFAULT 0,
  "rewardPointTotal" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  CONSTRAINT "DailyOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyRankingSnapshot" (
  "id" UUID NOT NULL,
  "cycleDate" DATE NOT NULL,
  "userId" UUID NOT NULL,
  "rank" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "rewardPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyRankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyOperation_cycleDate_key" ON "DailyOperation"("cycleDate");
CREATE INDEX "DailyOperation_status_cycleDate_idx" ON "DailyOperation"("status", "cycleDate");
CREATE UNIQUE INDEX "DailyRankingSnapshot_cycleDate_userId_key" ON "DailyRankingSnapshot"("cycleDate", "userId");
CREATE INDEX "DailyRankingSnapshot_cycleDate_rank_idx" ON "DailyRankingSnapshot"("cycleDate", "rank");
CREATE INDEX "DailyRankingSnapshot_userId_cycleDate_idx" ON "DailyRankingSnapshot"("userId", "cycleDate");

ALTER TABLE "DailyRankingSnapshot"
ADD CONSTRAINT "DailyRankingSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RankingSettlement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period" VARCHAR(20) NOT NULL,
  "periodStart" TIMESTAMPTZ(3) NOT NULL,
  "periodEnd" TIMESTAMPTZ(3) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "rewardCount" INTEGER NOT NULL DEFAULT 0,
  "rewardPointTotal" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  CONSTRAINT "RankingSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RankingReward" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settlementId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "rank" INTEGER NOT NULL,
  "score" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "awardedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(3),
  CONSTRAINT "RankingReward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RankingReward_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RankingSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RankingReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RankingSettlement_period_periodStart_key" ON "RankingSettlement"("period", "periodStart");
CREATE INDEX "RankingSettlement_status_periodEnd_idx" ON "RankingSettlement"("status", "periodEnd");
CREATE UNIQUE INDEX "RankingReward_settlementId_userId_key" ON "RankingReward"("settlementId", "userId");
CREATE INDEX "RankingReward_userId_readAt_awardedAt_idx" ON "RankingReward"("userId", "readAt", "awardedAt");
CREATE INDEX "RankingReward_settlementId_rank_idx" ON "RankingReward"("settlementId", "rank");

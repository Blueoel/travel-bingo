CREATE TABLE "UserBadge" (
  "userId" UUID NOT NULL,
  "badgeId" UUID NOT NULL,
  "earnedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMPTZ(3),
  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId", "badgeId"),
  CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserBadge_userId_seenAt_earnedAt_idx" ON "UserBadge"("userId", "seenAt", "earnedAt");

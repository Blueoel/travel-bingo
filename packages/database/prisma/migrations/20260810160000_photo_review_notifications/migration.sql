ALTER TABLE "Verification" ADD COLUMN "seenAt" TIMESTAMPTZ(3);

CREATE INDEX "Verification_userId_seenAt_decidedAt_idx"
ON "Verification"("userId", "seenAt", "decidedAt");

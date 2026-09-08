CREATE TABLE "UserRegionMemory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "regionCode" VARCHAR(20) NOT NULL,
    "imageDataUrl" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 3,
    "selectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "UserRegionMemory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRegionMemory_userId_regionCode_key" ON "UserRegionMemory"("userId", "regionCode");
CREATE INDEX "UserRegionMemory_userId_selectedAt_idx" ON "UserRegionMemory"("userId", "selectedAt");
ALTER TABLE "UserRegionMemory" ADD CONSTRAINT "UserRegionMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

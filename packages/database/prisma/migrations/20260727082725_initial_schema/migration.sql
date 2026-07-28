-- Enable PostGIS before creating geometry columns.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'CLEAR', 'PERFECT_CLEAR', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SessionCellStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('GPS', 'QR', 'QUIZ', 'PHOTO', 'COMPOSITE', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "nickname" VARCHAR(40) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "administrativeCode" VARCHAR(20) NOT NULL,
    "centerLatitude" DECIMAL(9,6) NOT NULL,
    "centerLongitude" DECIMAL(9,6) NOT NULL,
    "populationDeclineFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "externalContentId" VARCHAR(100) NOT NULL,
    "contentType" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "location" geometry(Point,4326),
    "imageUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceUpdatedAt" TIMESTAMPTZ(3),
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoTheme" (
    "id" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "isRequiredForRegionCompletion" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BingoTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoTemplate" (
    "id" UUID NOT NULL,
    "regionId" UUID NOT NULL,
    "themeId" UUID NOT NULL,
    "ownerId" UUID,
    "title" VARCHAR(120) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BingoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" UUID NOT NULL,
    "placeId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "verificationPolicy" JSONB NOT NULL,
    "radiusM" INTEGER,
    "points" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateCell" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BingoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCell" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "missionSnapshot" JSONB NOT NULL,
    "status" "SessionCellStatus" NOT NULL DEFAULT 'AVAILABLE',
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SessionCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "sessionCellId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracyM" DECIMAL(8,2),
    "measuredAt" TIMESTAMPTZ(3),
    "distanceM" DECIMAL(10,2),
    "photoKey" TEXT,
    "reasonCode" VARCHAR(60),
    "reasonDetail" TEXT,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoLineReward" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "lineKey" VARCHAR(30) NOT NULL,
    "points" INTEGER NOT NULL,
    "awardedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BingoLineReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID,
    "referenceType" VARCHAR(40) NOT NULL,
    "referenceId" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Region_administrativeCode_key" ON "Region"("administrativeCode");

-- CreateIndex
CREATE INDEX "Region_status_populationDeclineFlag_idx" ON "Region"("status", "populationDeclineFlag");

-- CreateIndex
CREATE INDEX "Place_regionId_contentType_status_idx" ON "Place"("regionId", "contentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Place_source_externalContentId_contentType_key" ON "Place"("source", "externalContentId", "contentType");

-- CreateIndex
CREATE INDEX "BingoTheme_regionId_status_displayOrder_idx" ON "BingoTheme"("regionId", "status", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BingoTheme_regionId_name_key" ON "BingoTheme"("regionId", "name");

-- CreateIndex
CREATE INDEX "BingoTemplate_regionId_status_startsAt_endsAt_idx" ON "BingoTemplate"("regionId", "status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BingoTemplate_themeId_version_key" ON "BingoTemplate"("themeId", "version");

-- CreateIndex
CREATE INDEX "Mission_placeId_status_idx" ON "Mission"("placeId", "status");

-- CreateIndex
CREATE INDEX "Mission_category_status_idx" ON "Mission"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCell_templateId_position_key" ON "TemplateCell"("templateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCell_templateId_missionId_key" ON "TemplateCell"("templateId", "missionId");

-- CreateIndex
CREATE INDEX "BingoSession_userId_status_updatedAt_idx" ON "BingoSession"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BingoSession_userId_idempotencyKey_key" ON "BingoSession"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SessionCell_sessionId_status_idx" ON "SessionCell"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCell_sessionId_position_key" ON "SessionCell"("sessionId", "position");

-- CreateIndex
CREATE INDEX "Verification_sessionCellId_status_submittedAt_idx" ON "Verification"("sessionCellId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "Verification_status_submittedAt_idx" ON "Verification"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_userId_idempotencyKey_key" ON "Verification"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BingoLineReward_sessionId_lineKey_key" ON "BingoLineReward"("sessionId", "lineKey");

-- CreateIndex
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointLedger_referenceType_referenceId_reason_key" ON "PointLedger"("referenceType", "referenceId", "reason");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_occurredAt_idx" ON "OutboxEvent"("processedAt", "occurredAt");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoTheme" ADD CONSTRAINT "BingoTheme_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoTemplate" ADD CONSTRAINT "BingoTemplate_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoTemplate" ADD CONSTRAINT "BingoTemplate_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "BingoTheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoTemplate" ADD CONSTRAINT "BingoTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCell" ADD CONSTRAINT "TemplateCell_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BingoTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCell" ADD CONSTRAINT "TemplateCell_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoSession" ADD CONSTRAINT "BingoSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoSession" ADD CONSTRAINT "BingoSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BingoTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCell" ADD CONSTRAINT "SessionCell_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BingoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_sessionCellId_fkey" FOREIGN KEY ("sessionCellId") REFERENCES "SessionCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BingoLineReward" ADD CONSTRAINT "BingoLineReward_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BingoSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BingoSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints that Prisma Schema Language cannot express.
ALTER TABLE "Region"
ADD CONSTRAINT "Region_centerLatitude_check" CHECK ("centerLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "Region_centerLongitude_check" CHECK ("centerLongitude" BETWEEN -180 AND 180);

ALTER TABLE "Place"
ADD CONSTRAINT "Place_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "Place_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_radiusM_check" CHECK ("radiusM" IS NULL OR "radiusM" BETWEEN 50 AND 300),
ADD CONSTRAINT "Mission_points_check" CHECK ("points" >= 0),
ADD CONSTRAINT "Mission_difficulty_check" CHECK ("difficulty" BETWEEN 1 AND 5);

ALTER TABLE "TemplateCell"
ADD CONSTRAINT "TemplateCell_position_check" CHECK ("position" BETWEEN 0 AND 24);

ALTER TABLE "SessionCell"
ADD CONSTRAINT "SessionCell_position_check" CHECK ("position" BETWEEN 0 AND 24);

ALTER TABLE "Verification"
ADD CONSTRAINT "Verification_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "Verification_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "Verification_accuracyM_check" CHECK ("accuracyM" IS NULL OR "accuracyM" >= 0),
ADD CONSTRAINT "Verification_distanceM_check" CHECK ("distanceM" IS NULL OR "distanceM" >= 0);

CREATE INDEX "Place_location_gist_idx" ON "Place" USING GIST ("location");

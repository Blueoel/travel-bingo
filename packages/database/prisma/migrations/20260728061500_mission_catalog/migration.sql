CREATE TYPE "MissionScope" AS ENUM ('COMMON', 'REGION', 'EVENT');

ALTER TABLE "Mission"
ADD COLUMN "scope" "MissionScope" NOT NULL DEFAULT 'COMMON';

CREATE TABLE "MissionRegion" (
  "missionId" UUID NOT NULL,
  "regionId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionRegion_pkey" PRIMARY KEY ("missionId", "regionId")
);

CREATE TABLE "MissionCollection" (
  "id" UUID NOT NULL,
  "regionId" UUID,
  "name" VARCHAR(120) NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "description" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "MissionCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionCollectionItem" (
  "collectionId" UUID NOT NULL,
  "missionId" UUID NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionCollectionItem_pkey" PRIMARY KEY ("collectionId", "missionId")
);

CREATE TABLE "MissionRevision" (
  "id" UUID NOT NULL,
  "missionId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changeNote" VARCHAR(300),
  "changedById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Mission_scope_status_category_idx" ON "Mission"("scope", "status", "category");
CREATE INDEX "MissionRegion_regionId_missionId_idx" ON "MissionRegion"("regionId", "missionId");
CREATE UNIQUE INDEX "MissionCollection_type_regionId_name_key" ON "MissionCollection"("type", "regionId", "name");
CREATE INDEX "MissionCollection_type_regionId_status_idx" ON "MissionCollection"("type", "regionId", "status");
CREATE INDEX "MissionCollectionItem_collectionId_displayOrder_idx" ON "MissionCollectionItem"("collectionId", "displayOrder");
CREATE INDEX "MissionCollectionItem_missionId_idx" ON "MissionCollectionItem"("missionId");
CREATE UNIQUE INDEX "MissionRevision_missionId_revision_key" ON "MissionRevision"("missionId", "revision");
CREATE INDEX "MissionRevision_missionId_createdAt_idx" ON "MissionRevision"("missionId", "createdAt");

ALTER TABLE "MissionRegion" ADD CONSTRAINT "MissionRegion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionRegion" ADD CONSTRAINT "MissionRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionCollection" ADD CONSTRAINT "MissionCollection_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionCollectionItem" ADD CONSTRAINT "MissionCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "MissionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionCollectionItem" ADD CONSTRAINT "MissionCollectionItem_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionRevision" ADD CONSTRAINT "MissionRevision_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionRevision" ADD CONSTRAINT "MissionRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

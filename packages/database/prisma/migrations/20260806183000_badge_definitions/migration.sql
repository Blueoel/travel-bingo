CREATE TABLE "BadgeDefinition" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240) NOT NULL,
  "icon" VARCHAR(20) NOT NULL,
  "imageUrl" TEXT,
  "metric" VARCHAR(40) NOT NULL,
  "target" INTEGER NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BadgeDefinition_code_key" ON "BadgeDefinition"("code");
CREATE INDEX "BadgeDefinition_status_displayOrder_idx" ON "BadgeDefinition"("status", "displayOrder");

INSERT INTO "BadgeDefinition" ("code", "title", "description", "icon", "metric", "target", "displayOrder", "updatedAt") VALUES
('FIRST_STEP', '첫 발자국', '첫 번째 미션을 완료했어요.', '👣', 'COMPLETED_MISSIONS', 1, 10, CURRENT_TIMESTAMP),
('WALK_COLLECTOR', '산책 수집가', '미션 10개를 완료했어요.', '🌿', 'COMPLETED_MISSIONS', 10, 20, CURRENT_TIMESTAMP),
('BINGO_START', '빙고의 시작', '첫 빙고판을 완성했어요.', '⭐', 'COMPLETED_BINGOS', 1, 30, CURRENT_TIMESTAMP),
('REGION_EXPLORER', '지역 탐험가', '지역 빙고판을 완성했어요.', '🗺️', 'COMPLETED_REGIONS', 1, 40, CURRENT_TIMESTAMP),
('POINT_KEEPER', '발견의 기록', '누적 500 Point를 모았어요.', '🏅', 'POINTS', 500, 50, CURRENT_TIMESTAMP),
('BINGO_MASTER', '빙고 마스터', '빙고판 5개를 완성했어요.', '🏆', 'COMPLETED_BINGOS', 5, 60, CURRENT_TIMESTAMP);

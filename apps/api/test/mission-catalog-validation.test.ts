import { describe, expect, it } from "vitest";

import { MissionCatalogService } from "../src/admin/mission-catalog.service.js";

const adminId = "10000000-0000-4000-8000-000000000002";
const baseMission = {
  title: "오늘의 한 줄",
  description: "오늘 기억에 남는 순간을 기록하세요.",
  scope: "COMMON" as const,
  category: "기록",
  difficulty: "EASY" as const,
  estimatedMinutesMin: 1,
  estimatedMinutesMax: 5,
  regionIds: [],
};

describe("admin mission verification settings", () => {
  const service = new MissionCatalogService({} as never);

  it("rejects text limits outside the short-sentence range", async () => {
    await expect(
      service.create(
        {
          ...baseMission,
          verificationType: "TEXT",
          verificationPolicy: { type: "TEXT", maxLength: 101 },
        },
        adminId,
      ),
    ).rejects.toThrow(/maxLength between 1 and 100/);
  });

  it("rejects timer targets shorter than one minute", async () => {
    await expect(
      service.create(
        {
          ...baseMission,
          verificationType: "TIMER",
          verificationPolicy: { type: "TIMER", durationSeconds: 59 },
        },
        adminId,
      ),
    ).rejects.toThrow(/durationSeconds between 60 and 10800/);
  });

  it("rejects a GPS place mission without a safe verification radius", async () => {
    await expect(
      service.create(
        {
          ...baseMission,
          scope: "REGION",
          regionIds: ["10000000-0000-4000-8000-000000000010"],
          verificationType: "GPS",
          verificationPolicy: {
            type: "GPS",
            maximumAccuracyM: 50,
            maximumAgeMs: 60_000,
          },
          radiusM: 10,
          place: {
            title: "안성맞춤랜드",
            latitude: 37.03,
            longitude: 127.31,
          },
        },
        adminId,
      ),
    ).rejects.toThrow(/radius between 30 and 1000 meters/);
  });

  it("rejects a duplicate KTO place mission in the same region", async () => {
    const duplicateService = new MissionCatalogService({
      mission: {
        findFirst: async () => ({ title: "안성맞춤랜드 방문하기" }),
      },
    } as never);

    await expect(
      duplicateService.create(
        {
          ...baseMission,
          title: "안성맞춤랜드 다시 방문하기",
          scope: "REGION",
          regionIds: ["10000000-0000-4000-8000-000000000010"],
          verificationType: "GPS",
          verificationPolicy: {
            type: "GPS",
            maximumAccuracyM: 50,
            maximumAgeMs: 60_000,
          },
          radiusM: 100,
          place: {
            title: "안성맞춤랜드",
            latitude: 37.03,
            longitude: 127.31,
            source: "KTO",
            externalContentId: "kto-place-1",
            contentType: "12",
          },
        },
        adminId,
      ),
    ).rejects.toThrow(/이미 '안성맞춤랜드 방문하기' 미션으로 등록/);
  });
});

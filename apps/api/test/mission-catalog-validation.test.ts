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
});

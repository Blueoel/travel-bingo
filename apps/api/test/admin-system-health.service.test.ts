import type { DatabaseClient } from "@travel-bingo/database";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminSystemHealthService } from "../src/health/admin-system-health.service.js";

describe("AdminSystemHealthService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_VISION_MODEL;
    delete process.env.KTO_API_KEY;
  });

  it("summarizes service connectivity and content readiness", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.GEMINI_VISION_MODEL = "gemini-test-model";
    process.env.KTO_API_KEY = "test-kto-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response('{"response":{"header":{"resultCode":"0000"}}}', {
            status: 200,
          }),
        ),
    );
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      missionCollection: {
        findFirst: vi.fn().mockResolvedValue({
          items: Array.from({ length: 30 }, (_, index) => ({
            missionId: `mission-${index}`,
          })),
        }),
      },
      region: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "region-ready",
            name: "준비 지역",
            missionLinks: Array.from({ length: 25 }, (_, index) => ({
              missionId: `ready-${index}`,
            })),
          },
          {
            id: "region-needs-content",
            name: "준비 중 지역",
            missionLinks: Array.from({ length: 20 }, (_, index) => ({
              missionId: `pending-${index}`,
            })),
          },
        ]),
      },
      verification: { count: vi.fn().mockResolvedValue(2) },
      outboxEvent: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      dailyOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      rankingSettlement: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as DatabaseClient;

    const result = await new AdminSystemHealthService(database).inspect();

    expect(result.status).toBe("WARNING");
    expect(
      result.components.every((component) => component.status === "HEALTHY"),
    ).toBe(true);
    expect(result.content.dailyCandidateCount).toBe(30);
    expect(result.content.readyRegionCount).toBe(1);
    expect(result.content.regionsNeedingMissions[0]).toMatchObject({
      name: "준비 중 지역",
      activeMissionCount: 20,
      missingMissionCount: 5,
    });
    expect(result.content.pendingPhotoReviewCount).toBe(2);
    expect(result.content.luckyChancePercent).toBe(20);
    expect(result.content.luckyPoints).toBe(50);
  });
});

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
        count: vi.fn().mockResolvedValue(3),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              topic: "mission.verified",
              occurredAt: new Date("2026-08-10T00:00:00.000Z"),
              attempts: 0,
              lastError: null,
            },
            {
              topic: "mission.verified",
              occurredAt: new Date("2026-08-10T01:00:00.000Z"),
              attempts: 0,
              lastError: null,
            },
            {
              topic: "mission.review_requested",
              occurredAt: new Date("2026-08-10T02:00:00.000Z"),
              attempts: 0,
              lastError: null,
            },
          ])
          .mockResolvedValueOnce([]),
      },
      dailyOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      rankingSettlement: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as DatabaseClient;

    const result = await new AdminSystemHealthService(database).inspect();

    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toContain(
      "/B551011/KorService2/ldongCode2?",
    );

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
    expect(result.content.pendingOutboxCount).toBe(3);
    expect(result.content.outboxFailedCount).toBe(0);
    expect(result.content.outboxWorkerConnected).toBe(false);
    expect(result.content.outboxTopics).toEqual([
      { topic: "mission.verified", count: 2, failedCount: 0 },
      { topic: "mission.review_requested", count: 1, failedCount: 0 },
    ]);
    expect(result.content.luckyChancePercent).toBe(20);
    expect(result.content.luckyPoints).toBe(50);
    expect(result.components.find((item) => item.key === "kto")?.detail).toBe(
      "응답 코드 0000",
    );
  });

  it("reports the tourism provider error code without exposing the key", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    process.env.KTO_API_KEY = "secret-kto-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              OpenAPI_ServiceResponse: {
                cmmMsgHeader: {
                  returnReasonCode: "30",
                  returnAuthMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                },
              },
            }),
            { status: 200 },
          ),
        ),
    );
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
      missionCollection: { findFirst: vi.fn().mockResolvedValue(null) },
      region: { findMany: vi.fn().mockResolvedValue([]) },
      verification: { count: vi.fn().mockResolvedValue(0) },
      outboxEvent: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      dailyOperation: { findFirst: vi.fn().mockResolvedValue(null) },
      rankingSettlement: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as DatabaseClient;

    const result = await new AdminSystemHealthService(database).inspect();
    const kto = result.components.find((item) => item.key === "kto");

    expect(kto).toMatchObject({
      status: "WARNING",
      detail: "HTTP 200 · 응답 코드 30 · SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
    });
    expect(JSON.stringify(result)).not.toContain("secret-kto-key");
  });
});

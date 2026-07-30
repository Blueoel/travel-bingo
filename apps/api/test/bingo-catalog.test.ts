import { describe, expect, it, vi } from "vitest";

import { BingoCatalogService } from "../src/bingo-catalog/bingo-catalog.service.js";

describe("BingoCatalogService", () => {
  it("lists ongoing sessions before available active-region templates", async () => {
    const database = {
      bingoSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "daily-session",
            templateId: "daily-template",
            status: "ACTIVE",
            totalPoints: 30,
            cells: [{ status: "VERIFIED" }, { status: "AVAILABLE" }],
            template: {
              type: "DAILY",
              title: "오늘의 Daily 빙고",
              startsAt: null,
              endsAt: null,
              region: { name: "안성시" },
            },
          },
        ]),
      },
      bingoTemplate: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "region-template",
            type: "REGION",
            title: "안성 원도심 빙고",
            startsAt: null,
            endsAt: null,
            region: { name: "경기도 안성시" },
            _count: { cells: 25 },
          },
        ]),
      },
    };
    const service = new BingoCatalogService(database as never);

    const result = await service.list(
      "user-1",
      new Date("2026-07-30T00:00:00.000Z"),
    );

    expect(result).toEqual([
      expect.objectContaining({
        type: "DAILY",
        state: "IN_PROGRESS",
        completedCellCount: 1,
        totalPoints: 30,
      }),
      expect.objectContaining({
        type: "REGION",
        state: "AVAILABLE",
        regionName: "경기도 안성시",
        totalCellCount: 25,
      }),
    ]);
    expect(database.bingoTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          region: { status: "ACTIVE" },
        }),
      }),
    );
  });

  it("does not duplicate an available template that already has a session", async () => {
    const database = {
      bingoSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "region-session",
            templateId: "region-template",
            status: "CLEAR",
            totalPoints: 500,
            cells: [{ status: "VERIFIED" }],
            template: {
              type: "REGION",
              title: "안성 원도심 빙고",
              startsAt: null,
              endsAt: null,
              region: { name: "경기도 안성시" },
            },
          },
        ]),
      },
      bingoTemplate: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "region-template",
            type: "REGION",
            title: "안성 원도심 빙고",
            startsAt: null,
            endsAt: null,
            region: { name: "경기도 안성시" },
            _count: { cells: 25 },
          },
        ]),
      },
    };

    const result = await new BingoCatalogService(database as never).list(
      "user-1",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      state: "COMPLETED",
      sessionId: "region-session",
    });
  });
});

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

  it("creates a 25-cell region session and returns its board", async () => {
    const templateCells = Array.from({ length: 25 }, (_, position) => ({
      position,
      mission: {
        id: `mission-${position}`,
        kind: "CHECK_IN",
        title: `지역 미션 ${position + 1}`,
        description: "지역을 발견해보세요.",
        category: "REGION",
        verificationPolicy: { type: "CHECK_IN" },
        targetValue: null,
        targetUnit: null,
        radiusM: null,
        points: 10,
        difficulty: 1,
        estimatedMinutesMin: null,
        estimatedMinutesMax: null,
        similarityGroup: null,
        place: null,
      },
    }));
    const createdBoard = {
      id: "region-session",
      status: "ACTIVE",
      totalPoints: 0,
      template: {
        id: "region-template",
        type: "REGION",
        title: "안성 원도심 빙고",
        region: { name: "경기도 안성시" },
      },
      cells: templateCells.map(({ position, mission }) => ({
        id: `cell-${position}`,
        position,
        status: "AVAILABLE",
        missionSnapshot: mission,
      })),
    };
    const database = {
      bingoSession: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdBoard),
        create: vi.fn().mockResolvedValue({ id: "region-session" }),
      },
      bingoTemplate: {
        findFirst: vi.fn().mockResolvedValue({
          id: "region-template",
          cells: templateCells,
        }),
      },
    };

    const result = await new BingoCatalogService(database as never)
      .createOrGetSession({
        userId: "user-1",
        templateId: "region-template",
        idempotencyKey: "region-start-1",
      });

    expect(database.bingoSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "region-template",
          cells: { create: expect.arrayContaining([expect.any(Object)]) },
        }),
      }),
    );
    expect(result).toMatchObject({
      id: "region-session",
      type: "REGION",
      title: "안성 원도심 빙고",
      totalPoints: 0,
      completedCellCount: 0,
    });
    expect(result.cells).toHaveLength(25);
  });
});

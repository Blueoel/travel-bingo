import { describe, expect, it, vi } from "vitest";

import { BingoCatalogService } from "../src/bingo-catalog/bingo-catalog.service.js";

interface RegionalMissionFixture {
  id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
  verificationPolicy: { type: string };
  targetValue: null;
  targetUnit: null;
  radiusM: null;
  points: number;
  difficulty: number;
  estimatedMinutesMin: null;
  estimatedMinutesMax: null;
  similarityGroup: string | null;
  place: null;
}

function regionalMission(
  index: number,
  difficulty: number,
): RegionalMissionFixture {
  const kinds = ["PHOTO", "CHECK_IN", "QUIZ", "PLACE_VISIT", "COMPOSITE"];
  const kind = kinds[index % kinds.length]!;
  return {
    id: `active-${index}`,
    kind,
    title: `지역 미션 ${index + 1}`,
    description: `지역 미션 ${index + 1} 설명`,
    category: "REGION",
    verificationPolicy: { type: kind },
    targetValue: null,
    targetUnit: null,
    radiusM: null,
    points: difficulty * 10,
    difficulty,
    estimatedMinutesMin: null,
    estimatedMinutesMax: null,
    similarityGroup: index < 8 ? "COLOR_SEARCH" : `GROUP_${index}`,
    place: null,
  };
}

function regionalMissionPool(): RegionalMissionFixture[] {
  return [
    ...Array.from({ length: 30 }, (_, index) => regionalMission(index, 1)),
    ...Array.from({ length: 17 }, (_, index) => regionalMission(index + 30, 2)),
    ...Array.from({ length: 7 }, (_, index) => regionalMission(index + 47, 3)),
  ];
}

function regionalSessionHarness(activeMissions: RegionalMissionFixture[]) {
  const sessions = new Map<string, Record<string, unknown>>();
  const scaffoldMissions = Array.from({ length: 25 }, (_, index) => ({
    ...regionalMission(index + 100, 1),
    id: `inactive-scaffold-${index}`,
  }));
  const template = {
    id: "region-template",
    type: "REGION",
    version: 4,
    title: "안성 여행 빙고",
    region: {
      name: "경기도 안성시",
      administrativeCode: "41550",
      missionLinks: activeMissions.map((mission) => ({ mission })),
    },
    cells: scaffoldMissions.map((mission, position) => ({
      position,
      mission,
    })),
  };
  const findFirst = vi.fn(async ({ where }: { where: Record<string, string> }) => {
    if (where.id) {
      const session = sessions.get(where.id);
      return session && session.userId === where.userId ? session : null;
    }
    return (
      [...sessions.values()].find(
        (session) =>
          session.userId === where.userId &&
          session.templateId === where.templateId,
      ) ?? null
    );
  });
  const create = vi.fn(async ({ data }: { data: Record<string, any> }) => {
    const id = `session-${data.userId}`;
    const session = {
      id,
      userId: data.userId,
      templateId: data.templateId,
      status: "ACTIVE",
      totalPoints: 0,
      template: {
        id: template.id,
        type: template.type,
        title: template.title,
        region: {
          name: template.region.name,
          administrativeCode: template.region.administrativeCode,
        },
      },
      cells: data.cells.create.map(
        (cell: { position: number; missionSnapshot: unknown }) => ({
          id: `${id}-cell-${cell.position}`,
          position: cell.position,
          status: "AVAILABLE",
          missionSnapshot: cell.missionSnapshot,
        }),
      ),
    };
    sessions.set(id, session);
    return { id };
  });
  const database = {
    bingoSession: { findFirst, create },
    bingoTemplate: { findFirst: vi.fn().mockResolvedValue(template) },
  };

  return { database, template, sessions };
}

function boardMissionIds(board: { cells: readonly { mission: unknown }[] }) {
  return board.cells.map(
    (cell) => (cell.mission as { id: string }).id,
  );
}

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
    expect(database.bingoSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          OR: expect.arrayContaining([
            expect.objectContaining({
              dailyDate: new Date("2026-07-30T00:00:00.000Z"),
            }),
          ]),
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
          type: "REGION",
          version: 1,
          region: {
            missionLinks: templateCells.map(({ mission }) => ({ mission })),
          },
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
          dailyDate: null,
          layoutVariant: null,
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

  it("creates different balanced region boards for different users from the active mission pool", async () => {
    const harness = regionalSessionHarness(regionalMissionPool());
    const service = new BingoCatalogService(harness.database as never);

    const first = await service.createOrGetSession({
      userId: "region-user-a",
      templateId: "region-template",
      idempotencyKey: "region-a",
    });
    const second = await service.createOrGetSession({
      userId: "region-user-b",
      templateId: "region-template",
      idempotencyKey: "region-b",
    });
    const firstIds = boardMissionIds(first);
    const secondIds = boardMissionIds(second);
    const firstMissions = first.cells.map(
      (cell) => cell.mission as RegionalMissionFixture,
    );

    expect(firstIds).toHaveLength(25);
    expect(new Set(firstIds).size).toBe(25);
    expect(new Set(secondIds).size).toBe(25);
    expect(secondIds).not.toEqual(firstIds);
    expect(firstIds.every((id) => id.startsWith("active-"))).toBe(true);
    expect(firstIds.some((id) => id.startsWith("inactive-scaffold-"))).toBe(false);
    expect(firstMissions.filter((mission) => mission.difficulty === 1)).toHaveLength(13);
    expect(firstMissions.filter((mission) => mission.difficulty === 2)).toHaveLength(9);
    expect(firstMissions.filter((mission) => mission.difficulty === 3)).toHaveLength(3);
    expect(
      firstMissions.filter(
        (mission) => mission.similarityGroup === "COLOR_SEARCH",
      ).length,
    ).toBeLessThanOrEqual(3);
  });

  it("keeps an existing regional board unchanged when the active mission pool changes", async () => {
    const harness = regionalSessionHarness(regionalMissionPool());
    const service = new BingoCatalogService(harness.database as never);
    const first = await service.createOrGetSession({
      userId: "returning-region-user",
      templateId: "region-template",
      idempotencyKey: "first-start",
    });
    const firstIds = boardMissionIds(first);

    harness.template.region.missionLinks = regionalMissionPool()
      .slice(10)
      .map((mission) => ({ mission }));
    const reopened = await service.createOrGetSession({
      userId: "returning-region-user",
      templateId: "region-template",
      idempotencyKey: "reopen-after-pool-change",
    });

    expect(boardMissionIds(reopened)).toEqual(firstIds);
    expect(harness.database.bingoTemplate.findFirst).toHaveBeenCalledTimes(1);
    expect(harness.database.bingoSession.create).toHaveBeenCalledTimes(1);
  });

  it("refuses to create a regional board when fewer than 25 active missions remain", async () => {
    const harness = regionalSessionHarness(regionalMissionPool().slice(0, 24));
    const service = new BingoCatalogService(harness.database as never);

    await expect(
      service.createOrGetSession({
        userId: "region-user-short-pool",
        templateId: "region-template",
        idempotencyKey: "short-pool",
      }),
    ).rejects.toThrow("25");
    expect(harness.database.bingoSession.create).not.toHaveBeenCalled();
  });
});

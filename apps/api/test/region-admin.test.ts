import { describe, expect, it, vi } from "vitest";

import { MissionCatalogService } from "../src/admin/mission-catalog.service.js";

describe("region administration", () => {
  it("reports bingo readiness from active missions and published 25-cell boards", async () => {
    const database = {
      region: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ready",
            name: "준비 지역",
            administrativeCode: "10000",
            status: "INACTIVE",
            missionLinks: Array.from({ length: 25 }, (_, index) => ({
              missionId: `mission-${index}`,
            })),
            templates: [
              {
                id: "board",
                title: "지역 빙고",
                _count: { cells: 25 },
              },
            ],
          },
          {
            id: "draft",
            name: "준비 중 지역",
            administrativeCode: "20000",
            status: "INACTIVE",
            missionLinks: Array.from({ length: 20 }, (_, index) => ({
              missionId: `draft-${index}`,
            })),
            templates: [],
          },
        ]),
      },
    };

    const result = await new MissionCatalogService(database as never)
      .listRegions();

    expect(result[0]).toMatchObject({
      canActivate: true,
      activeMissionCount: 25,
      publishedBoardCount: 1,
      missingMissionCount: 0,
    });
    expect(result[1]).toMatchObject({
      canActivate: false,
      missingMissionCount: 5,
    });
  });

  it("prevents activation until a region bingo is ready", async () => {
    const database = {
      region: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "draft",
            name: "준비 중 지역",
            administrativeCode: "20000",
            status: "INACTIVE",
            missionLinks: [],
            templates: [],
          },
        ]),
        update: vi.fn(),
      },
    };
    const service = new MissionCatalogService(database as never);

    await expect(service.updateRegionStatus("draft", "ACTIVE")).rejects.toThrow(
      "지역 미션 25개",
    );
    expect(database.region.update).not.toHaveBeenCalled();
  });

  it("publishes a 25-cell board and activates the region in one operation", async () => {
    const transaction = {
      region: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ready",
          name: "경기도 준비시",
          missionLinks: Array.from({ length: 25 }, (_, index) => ({
            missionId: `mission-${index}`,
          })),
        }),
        update: vi.fn(),
      },
      bingoTheme: {
        findFirst: vi.fn().mockResolvedValue({ id: "theme" }),
        create: vi.fn(),
      },
      bingoTemplate: {
        findFirst: vi.fn().mockResolvedValue({ version: 1 }),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const database = {
      $transaction: vi.fn(async (operation) => operation(transaction)),
      region: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ready",
            name: "경기도 준비시",
            administrativeCode: "30000",
            status: "ACTIVE",
            missionLinks: Array.from({ length: 25 }, (_, index) => ({
              missionId: `mission-${index}`,
            })),
            templates: [
              {
                id: "board",
                title: "준비시 여행 빙고",
                _count: { cells: 25 },
              },
            ],
          },
        ]),
      },
    };

    const selectedMissionIds = Array.from(
      { length: 25 },
      (_, index) => `mission-${24 - index}`,
    );
    const result = await new MissionCatalogService(database as never)
      .publishRegionBoard("ready", "admin", selectedMissionIds);

    expect(transaction.bingoTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PUBLISHED",
        type: "REGION",
        version: 2,
        cells: {
          create: selectedMissionIds.map((missionId, position) => ({
            missionId,
            position,
          })),
        },
      }),
    });
    expect(transaction.region.update).toHaveBeenCalledWith({
      where: { id: "ready" },
      data: { status: "ACTIVE" },
    });
    expect(result).toMatchObject({ canActivate: true, status: "ACTIVE" });
  });
});

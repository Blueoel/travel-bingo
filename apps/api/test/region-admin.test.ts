import { describe, expect, it, vi } from "vitest";

import { MissionCatalogService } from "../src/admin/mission-catalog.service.js";

describe("region administration", () => {
  it("reports readiness from the active regional mission pool", async () => {
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
            templates: [],
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
      publishedBoardCount: 0,
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

    await expect(service.updateRegionStatus("draft", "ACTIVE", "admin")).rejects.toThrow(
      "활성 지역 미션이 25개 이상",
    );
    expect(database.region.update).not.toHaveBeenCalled();
  });

  it("automatically prepares the regional template when activating a region", async () => {
    const transaction = {
      region: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ready",
          name: "경기도 준비시",
          missionLinks: Array.from({ length: 25 }, (_, index) => ({
            missionId: `mission-${index}`,
          })),
          templates: [],
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

    const result = await new MissionCatalogService(database as never)
      .updateRegionStatus("ready", "ACTIVE", "admin");

    expect(transaction.bingoTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PUBLISHED",
        type: "REGION",
        version: 2,
        cells: {
          create: Array.from({ length: 25 }, (_, position) => ({
            missionId: `mission-${position}`,
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

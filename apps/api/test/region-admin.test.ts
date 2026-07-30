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
});

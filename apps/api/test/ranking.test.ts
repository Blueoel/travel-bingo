import { describe, expect, it, vi } from "vitest";

import { RankingService } from "../src/ranking/ranking.service.js";

describe("RankingService filters", () => {
  it("limits a region ranking to the selected active region", async () => {
    const database = {
      pointLedger: { groupBy: vi.fn().mockResolvedValue([]) },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: "me", nickname: "여행자" }),
      },
      bingoSession: { findFirst: vi.fn() },
    };
    const result = await new RankingService(database as never).get(
      "me",
      "WEEKLY",
      "REGION",
      new Date("2026-08-04T03:00:00.000Z"),
      "31220",
    );

    expect(database.pointLedger.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: {
            template: {
              type: "REGION",
              region: { administrativeCode: "31220" },
            },
          },
        }),
      }),
    );
    expect(result.regionCode).toBe("31220");
  });

  it("returns a prepared empty friend ranking without mixing all users", async () => {
    const database = {
      pointLedger: { groupBy: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "me", nickname: "여행자" }),
      },
    };
    const result = await new RankingService(database as never).get(
      "me",
      "MONTHLY",
      "FRIEND",
    );

    expect(result.available).toBe(false);
    expect(result.entries).toEqual([]);
    expect(database.pointLedger.groupBy).not.toHaveBeenCalled();
  });
});

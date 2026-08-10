import { describe, expect, it, vi } from "vitest";

import { RankingSettlementService } from "../src/ranking/ranking-settlement.service.js";

describe("RankingSettlementService", () => {
  it("checks the latest completed weekly and monthly windows after a restart", async () => {
    const database = {
      rankingSettlement: {
        findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve({
          id: `${where.period_periodStart.period}-done`,
          status: "COMPLETED",
        })),
      },
    };

    const result = await new RankingSettlementService(database as never).runDue(
      new Date("2026-08-12T04:00:00.000Z"),
    );

    expect(result).toHaveLength(2);
    expect(database.rankingSettlement.findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        period_periodStart: {
          period: "WEEKLY",
          periodStart: new Date("2026-08-02T15:30:00.000Z"),
        },
      },
    });
    expect(database.rankingSettlement.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        period_periodStart: {
          period: "MONTHLY",
          periodStart: new Date("2026-06-30T15:30:00.000Z"),
        },
      },
    });
  });

  it("returns participant reward notifications and marks one as read", async () => {
    const awardedAt = new Date("2026-08-10T00:30:00.000Z");
    const database = {
      rankingReward: {
        findMany: vi.fn().mockResolvedValue([{ id: "reward-1", rank: 2, score: 180, points: 200, awardedAt, readAt: null, settlement: { period: "WEEKLY" } }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new RankingSettlementService(database as never);

    await expect(service.rewards("user-1")).resolves.toEqual([{
      id: "reward-1",
      period: "WEEKLY",
      rank: 2,
      score: 180,
      points: 200,
      awardedAt: awardedAt.toISOString(),
      isRead: false,
    }]);
    await expect(service.markRead("user-1", "reward-1")).resolves.toEqual({ read: true });
    expect(database.rankingReward.updateMany).toHaveBeenCalledWith({
      where: { id: "reward-1", userId: "user-1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("gives tied users the same rank and only rewards ranks one through three", async () => {
    const rankingReward = { createMany: vi.fn().mockResolvedValue({ count: 3 }) };
    const pointLedger = {
      groupBy: vi.fn().mockResolvedValue([
        { userId: "a", _sum: { points: 100 } },
        { userId: "b", _sum: { points: 100 } },
        { userId: "c", _sum: { points: 80 } },
        { userId: "d", _sum: { points: 70 } },
      ]),
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    };
    const transaction = {
      pointLedger,
      rankingReward,
      user: { findMany: vi.fn().mockResolvedValue(["a", "b", "c", "d"].map((id) => ({ id }))) },
      rankingSettlement: { update: vi.fn().mockResolvedValue({}) },
    };
    const database = {
      rankingSettlement: {
        findUnique: vi.fn().mockImplementation(({ where }) => Promise.resolve(
          where.period_periodStart.period === "MONTHLY" ? { id: "monthly-done", status: "COMPLETED" } : null,
        )),
        upsert: vi.fn().mockResolvedValue({ id: "weekly-settlement" }),
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((callback) => callback(transaction)),
    };

    await new RankingSettlementService(database as never).runDue(new Date("2026-08-12T04:00:00.000Z"));

    expect(rankingReward.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: "a", rank: 1, points: 300 }),
        expect.objectContaining({ userId: "b", rank: 1, points: 300 }),
        expect.objectContaining({ userId: "c", rank: 3, points: 100 }),
      ],
      skipDuplicates: true,
    });
    expect(transaction.rankingSettlement.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ participantCount: 4, rewardCount: 3, rewardPointTotal: 700 }),
    }));
  });
});

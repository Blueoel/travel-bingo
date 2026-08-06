import { describe, expect, it, vi } from "vitest";
import { FriendsService } from "../src/friends/friends.service.js";

describe("FriendsService", () => {
  it("accepts a reverse pending request instead of creating a duplicate", async () => {
    const database = {
      userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
      friendship: {
        findUnique: vi.fn().mockResolvedValue({ id: "request-1", status: "PENDING" }),
        update: vi.fn().mockResolvedValue({ id: "request-1", status: "ACCEPTED" }),
        upsert: vi.fn(),
      },
    };
    await new FriendsService(database as never).request("me", "friend");
    expect(database.friendship.update).toHaveBeenCalledWith({ where: { id: "request-1" }, data: { status: "ACCEPTED" } });
    expect(database.friendship.upsert).not.toHaveBeenCalled();
  });

  it("persists a newly earned badge once and returns it for celebration", async () => {
    const database = {
      pointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { points: 120 } }) },
      sessionCell: { count: vi.fn().mockResolvedValue(3) },
      bingoSession: { count: vi.fn().mockResolvedValue(0) },
      badgeDefinition: {
        findMany: vi.fn().mockResolvedValue([{ id: "badge-1", code: "FIRST_STEPS", title: "첫걸음", description: "첫 미션을 완료했어요.", icon: "🌱", imageUrl: null, metric: "COMPLETED_MISSIONS", target: 1 }]),
      },
      userBadge: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const result = await new FriendsService(database as never).syncBadges("me") as { newlyEarned: Array<{ id: string }> };
    expect(database.userBadge.createMany).toHaveBeenCalledOnce();
    expect(result.newlyEarned).toEqual([expect.objectContaining({ id: "FIRST_STEPS" })]);
  });
});

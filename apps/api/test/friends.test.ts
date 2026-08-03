import { describe, expect, it, vi } from "vitest";
import { FriendsService } from "../src/friends/friends.service.js";

describe("FriendsService", () => {
  it("accepts a reverse pending request instead of creating a duplicate", async () => {
    const database = {
      friendship: {
        findUnique: vi.fn().mockResolvedValue({ id: "request-1" }),
        update: vi.fn().mockResolvedValue({ id: "request-1", status: "ACCEPTED" }),
        upsert: vi.fn(),
      },
    };
    await new FriendsService(database as never).request("me", "friend");
    expect(database.friendship.update).toHaveBeenCalledWith({ where: { id: "request-1" }, data: { status: "ACCEPTED" } });
    expect(database.friendship.upsert).not.toHaveBeenCalled();
  });
});

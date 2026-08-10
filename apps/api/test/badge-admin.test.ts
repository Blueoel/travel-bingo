import { describe, expect, it, vi } from "vitest";
import { BadgeAdminService } from "../src/admin/badge-admin.service.js";

describe("BadgeAdminService test tools", () => {
  it("prepares a one-mission-away test badge for an active participant", async () => {
    const database = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user-1", email: "tester@example.com", nickname: "테스터" }) },
      sessionCell: { count: vi.fn().mockResolvedValue(7) },
      badgeDefinition: { create: vi.fn().mockImplementation(({ data }) => ({ id: "badge-1", ...data })) },
    };
    const result = await new BadgeAdminService(database as never).prepareTest("TESTER@example.com") as { target: number; badge: { code: string } };
    expect(result.target).toBe(8);
    expect(result.badge.code).toMatch(/^TEST_BADGE_/);
    expect(database.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: "tester@example.com" }) }));
  });

  it("cleans up only test badge definitions", async () => {
    const database = { badgeDefinition: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const result = await new BadgeAdminService(database as never).cleanupTests();
    expect(result).toEqual({ deleted: 2 });
    expect(database.badgeDefinition.deleteMany).toHaveBeenCalledWith({ where: { code: { startsWith: "TEST_BADGE_" } } });
  });
});

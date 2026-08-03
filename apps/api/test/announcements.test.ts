import { describe, expect, it, vi } from "vitest";

import { AnnouncementsService } from "../src/announcements/announcements.service.js";

describe("AnnouncementsService", () => {
  it("returns only currently published announcements with read state", async () => {
    const database = { announcement: { findMany: vi.fn().mockResolvedValue([{ id: "notice-1", reads: [{ readAt: new Date() }] }]) } };
    const result = await new AnnouncementsService(database as never).listPublished("user-1", new Date("2026-08-04T00:00:00Z"));
    expect(database.announcement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "PUBLISHED" }) }));
    expect(result).toEqual([{ id: "notice-1", isRead: true }]);
  });

  it("upserts a user-specific read receipt", async () => {
    const database = {
      announcement: { findUnique: vi.fn().mockResolvedValue({ id: "notice-1" }) },
      announcementRead: { upsert: vi.fn().mockResolvedValue({ announcementId: "notice-1", userId: "user-1" }) },
    };
    await new AnnouncementsService(database as never).markRead("notice-1", "user-1");
    expect(database.announcementRead.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { announcementId_userId: { announcementId: "notice-1", userId: "user-1" } } }));
  });
});

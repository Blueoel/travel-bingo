import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import { AnnouncementsService, type AdminAnnouncement, type AnnouncementRecord, type PublishedAnnouncement } from "./announcements.service.js";

@Controller("api/v1")
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService, private readonly auth: AuthService) {}

  @Get("announcements")
  async list(@Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<PublishedAnnouncement[]> {
    const userId = await this.auth.requireUserId(cookie, developmentUserId);
    return this.announcements.listPublished(userId);
  }

  @Post("announcements/:id/read")
  async markRead(@Param("id") id: string, @Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<{ announcementId: string; userId: string; readAt: Date }> {
    const userId = await this.auth.requireUserId(cookie, developmentUserId);
    return this.announcements.markRead(id, userId);
  }

  @Get("admin/announcements")
  async listAdmin(@Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<AdminAnnouncement[]> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.announcements.listAdmin();
  }

  @Post("admin/announcements")
  async create(@Body() body: Parameters<AnnouncementsService["create"]>[0], @Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<AnnouncementRecord> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.announcements.create(body);
  }

  @Patch("admin/announcements/:id")
  async update(@Param("id") id: string, @Body() body: Parameters<AnnouncementsService["update"]>[1], @Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<AnnouncementRecord> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.announcements.update(id, body);
  }

  @Delete("admin/announcements/:id")
  async remove(@Param("id") id: string, @Headers("cookie") cookie?: string, @Headers("x-user-id") developmentUserId?: string): Promise<{ deleted: boolean }> {
    await this.auth.requireAdminId(cookie, developmentUserId);
    return this.announcements.remove(id);
  }
}

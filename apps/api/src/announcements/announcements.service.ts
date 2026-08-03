import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

type AnnouncementInput = {
  title?: string;
  content?: string;
  status?: "DRAFT" | "PUBLISHED" | "ENDED";
  isImportant?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};
export type AnnouncementRecord = {
  id: string;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ENDED";
  isImportant: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type PublishedAnnouncement = AnnouncementRecord & { isRead: boolean };
export type AdminAnnouncement = AnnouncementRecord & { _count: { reads: number } };

@Injectable()
export class AnnouncementsService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: DatabaseClient) {}

  async listPublished(userId: string, now = new Date()): Promise<PublishedAnnouncement[]> {
    const items = await this.database.announcement.findMany({
      where: {
        status: "PUBLISHED",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
      include: { reads: { where: { userId }, select: { readAt: true } } },
    });
    return items.map(({ reads, ...item }) => ({ ...item, isRead: reads.length > 0 }));
  }

  async markRead(id: string, userId: string): Promise<{ announcementId: string; userId: string; readAt: Date }> {
    const announcement = await this.database.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!announcement) throw new NotFoundException("Announcement not found.");
    return this.database.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      create: { announcementId: id, userId },
      update: { readAt: new Date() },
    });
  }

  listAdmin(): Promise<AdminAnnouncement[]> {
    return this.database.announcement.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { reads: true } } },
    });
  }

  create(input: AnnouncementInput): Promise<AnnouncementRecord> {
    const data = this.toData(input, true);
    return this.database.announcement.create({
      data: {
        ...data,
        title: input.title!.trim(),
        content: input.content!.trim(),
      },
    });
  }

  async update(id: string, input: AnnouncementInput): Promise<AnnouncementRecord> {
    await this.requireExisting(id);
    return this.database.announcement.update({ where: { id }, data: this.toData(input, false) });
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    await this.requireExisting(id);
    await this.database.announcement.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireExisting(id: string) {
    if (!(await this.database.announcement.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException("Announcement not found.");
    }
  }

  private toData(input: AnnouncementInput, creating: boolean) {
    const title = input.title?.trim();
    const content = input.content?.trim();
    if (creating && !title) throw new BadRequestException("Title is required.");
    if (creating && !content) throw new BadRequestException("Content is required.");
    if (title !== undefined && !title) throw new BadRequestException("Title is required.");
    if (content !== undefined && !content) throw new BadRequestException("Content is required.");
    const startsAt = input.startsAt ? new Date(input.startsAt) : input.startsAt === null ? null : undefined;
    const endsAt = input.endsAt ? new Date(input.endsAt) : input.endsAt === null ? null : undefined;
    if (startsAt && endsAt && startsAt >= endsAt) throw new BadRequestException("End time must be after start time.");
    return {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isImportant !== undefined ? { isImportant: input.isImportant } : {}),
      ...(startsAt !== undefined ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
    };
  }
}

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import { DATABASE_CLIENT } from "../database/database.module.js";

@Injectable()
export class SupportService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async list(userId: string): Promise<unknown> {
    return this.db.userReport.findMany({
      where: { reporterId: userId, type: "INQUIRY" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, reason: true, subject: true, detail: true, adminReply: true, status: true, createdAt: true, respondedAt: true },
    });
  }

  async create(userId: string, input: { category?: string; subject?: string; detail?: string }): Promise<unknown> {
    const category = input.category?.trim().slice(0, 40) || "기타 문의";
    const subject = input.subject?.trim().slice(0, 100) || "";
    const detail = input.detail?.trim().slice(0, 500) || "";
    if (subject.length < 2 || detail.length < 5) throw new BadRequestException("제목과 문의 내용을 입력해주세요.");
    return this.db.userReport.create({ data: { reporterId: userId, reportedId: null, type: "INQUIRY", reason: category, subject, detail } });
  }
}

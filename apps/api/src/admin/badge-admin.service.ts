import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import { DATABASE_CLIENT } from "../database/database.module.js";

const METRICS = ["POINTS", "COMPLETED_MISSIONS", "COMPLETED_BINGOS", "COMPLETED_REGIONS"] as const;
export type BadgeInput = { code?: string; title?: string; description?: string; icon?: string; imageUrl?: string | null; metric?: string; target?: number; displayOrder?: number; status?: "ACTIVE" | "INACTIVE" };

@Injectable()
export class BadgeAdminService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}
  list(): Promise<unknown> { return this.db.badgeDefinition.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }); }
  async create(input: BadgeInput): Promise<unknown> { return this.db.badgeDefinition.create({ data: this.validate(input, true) }); }
  async update(id: string, input: BadgeInput): Promise<unknown> {
    const existing = await this.db.badgeDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Badge not found.");
    return this.db.badgeDefinition.update({ where: { id }, data: this.validate({
      code: input.code ?? existing.code,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      icon: input.icon ?? existing.icon,
      imageUrl: input.imageUrl === undefined ? existing.imageUrl : input.imageUrl,
      metric: input.metric ?? existing.metric,
      target: input.target ?? existing.target,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      status: input.status ?? (existing.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"),
    }, false) });
  }
  private validate(input: BadgeInput, creating: boolean) {
    const code = input.code?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const title = input.title?.trim(), description = input.description?.trim(), icon = input.icon?.trim();
    if (!code || !title || !description || !icon || !METRICS.includes(input.metric as typeof METRICS[number]) || !Number.isInteger(input.target) || Number(input.target) < 1) throw new BadRequestException("배지 필수값과 획득 기준을 확인해주세요.");
    return { code, title, description, icon, imageUrl: input.imageUrl?.trim() || null, metric: input.metric!, target: Number(input.target), displayOrder: Number(input.displayOrder) || 0, status: input.status ?? "ACTIVE", ...(creating ? {} : {}) };
  }
}

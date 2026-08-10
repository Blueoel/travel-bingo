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
  async prepareTest(email: string): Promise<unknown> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException("테스트할 참가자의 이메일을 입력해주세요.");
    const user = await this.db.user.findFirst({
      where: { email: normalizedEmail, role: "USER", status: "ACTIVE" },
      select: { id: true, email: true, nickname: true },
    });
    if (!user) throw new NotFoundException("활성 참가자 계정을 찾지 못했습니다.");
    const completedMissions = await this.db.sessionCell.count({
      where: { status: "VERIFIED", session: { userId: user.id } },
    });
    const code = `TEST_BADGE_${Date.now()}`;
    const badge = await this.db.badgeDefinition.create({
      data: {
        code,
        title: "실전 테스트 배지",
        description: "미션 인증 후 배지 축하와 알림 흐름을 확인하기 위한 임시 배지예요.",
        icon: "🧪",
        metric: "COMPLETED_MISSIONS",
        target: completedMissions + 1,
        displayOrder: -100,
        status: "ACTIVE",
      },
    });
    return { user, badge, current: completedMissions, target: completedMissions + 1 };
  }
  async resetTest(email: string, code: string): Promise<unknown> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !code.startsWith("TEST_BADGE_")) throw new BadRequestException("테스트 참가자와 배지를 확인해주세요.");
    const user = await this.db.user.findFirst({ where: { email: normalizedEmail, role: "USER" }, select: { id: true, email: true, nickname: true } });
    const badge = await this.db.badgeDefinition.findUnique({ where: { code } });
    if (!user || !badge || !badge.code.startsWith("TEST_BADGE_")) throw new NotFoundException("테스트 정보를 찾지 못했습니다.");
    const completedMissions = await this.db.sessionCell.count({ where: { status: "VERIFIED", session: { userId: user.id } } });
    await this.db.$transaction([
      this.db.userBadge.deleteMany({ where: { userId: user.id, badgeId: badge.id } }),
      this.db.badgeDefinition.update({ where: { id: badge.id }, data: { target: completedMissions + 1, status: "ACTIVE" } }),
    ]);
    return { user, badge: { ...badge, target: completedMissions + 1 }, current: completedMissions, target: completedMissions + 1 };
  }
  async cleanupTests(): Promise<{ deleted: number }> {
    const result = await this.db.badgeDefinition.deleteMany({ where: { code: { startsWith: "TEST_BADGE_" } } });
    return { deleted: result.count };
  }
  private validate(input: BadgeInput, creating: boolean) {
    const code = input.code?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const title = input.title?.trim(), description = input.description?.trim(), icon = input.icon?.trim();
    if (!code || !title || !description || !icon || !METRICS.includes(input.metric as typeof METRICS[number]) || !Number.isInteger(input.target) || Number(input.target) < 1) throw new BadRequestException("배지 필수값과 획득 기준을 확인해주세요.");
    return { code, title, description, icon, imageUrl: input.imageUrl?.trim() || null, metric: input.metric!, target: Number(input.target), displayOrder: Number(input.displayOrder) || 0, status: input.status ?? "ACTIVE", ...(creating ? {} : {}) };
  }
}

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";
import { getDailyCycle } from "../daily/daily-date.js";

export type RankingPeriod = "DAILY" | "WEEKLY" | "MONTHLY" | "TOTAL";
export type RankingScope = "ALL" | "COMMON" | "REGION" | "FRIEND";

@Injectable()
export class RankingService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async get(
    userId: string,
    period: RankingPeriod,
    scope: RankingScope,
    now = new Date(),
    regionCode?: string,
  ) {
    const window = rankingWindow(period, now);
    const friendUserIds = scope === "FRIEND" ? await this.findFriendUserIds(userId) : undefined;
    const selectedRegionCode =
      scope === "REGION"
        ? regionCode || (await this.findCurrentRegionCode(userId))
        : undefined;
    const grouped = await this.database.pointLedger.groupBy({
      by: ["userId"],
      where: {
        ...(friendUserIds ? { userId: { in: friendUserIds } } : {}),
        reason: { notIn: ["DAILY_RANK_REWARD", "WEEKLY_RANK_REWARD", "MONTHLY_RANK_REWARD", "DAILY_LUCKY"] },
        ...(window.startsAt
          ? { createdAt: { gte: window.startsAt, lt: window.endsAt } }
          : {}),
        ...(scope === "COMMON"
          ? { session: { template: { type: "DAILY" } } }
          : scope === "REGION"
            ? {
                session: {
                  template: {
                    type: "REGION",
                    ...(selectedRegionCode
                      ? {
                          region: {
                            administrativeCode: selectedRegionCode,
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
      },
      _sum: { points: true },
    });
    const users = await this.database.user.findMany({
      where: {
        id: { in: grouped.map((entry) => entry.userId) },
        role: "USER",
        status: "ACTIVE",
      },
      select: { id: true, nickname: true },
    });
    const nicknameById = new Map(users.map((user) => [user.id, user.nickname]));
    const sorted = grouped
      .map((entry) => ({
        userId: entry.userId,
        nickname: nicknameById.get(entry.userId),
        points: entry._sum.points ?? 0,
      }))
      .filter(
        (
          entry,
        ): entry is { userId: string; nickname: string; points: number } =>
          Boolean(entry.nickname) && entry.points > 0,
      )
      .sort((left, right) =>
        right.points === left.points
          ? left.userId.localeCompare(right.userId)
          : right.points - left.points,
      );

    let previousPoints: number | undefined;
    let rank = 0;
    const entries = sorted.map((entry, index) => {
      if (entry.points !== previousPoints) rank = index + 1;
      previousPoints = entry.points;
      return { ...entry, rank };
    });
    const me =
      entries.find((entry) => entry.userId === userId) ??
      (await this.database.user
        .findUnique({
          where: { id: userId },
          select: { id: true, nickname: true },
        })
        .then((user) =>
          user
            ? {
                userId: user.id,
                nickname: user.nickname,
                points: 0,
                rank: entries.length + 1,
              }
            : null,
        ));

    return {
      period,
      scope,
      startsAt: window.startsAt?.toISOString() ?? null,
      endsAt: window.endsAt?.toISOString() ?? null,
      entries: entries.slice(0, 10),
      me,
      regionCode: selectedRegionCode ?? null,
      available: true,
      unavailableReason: scope === "FRIEND" && friendUserIds?.length === 1 ? "친구를 추가하면 함께 순위를 볼 수 있어요." : null,
    };
  }

  private async findFriendUserIds(userId: string): Promise<string[]> {
    const rows = await this.database.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return [userId, ...rows.map((row) => row.requesterId === userId ? row.addresseeId : row.requesterId)];
  }

  private async findCurrentRegionCode(userId: string): Promise<string | undefined> {
    const session = await this.database.bingoSession.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "CLEAR"] },
        template: { type: "REGION" },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        template: {
          select: { region: { select: { administrativeCode: true } } },
        },
      },
    });
    return session?.template.region.administrativeCode;
  }
}

function rankingWindow(period: RankingPeriod, now: Date) {
  const daily = getDailyCycle(now);
  if (period === "DAILY") return daily;
  if (period === "TOTAL") return { startsAt: null, endsAt: null };
  const localDate = new Date(daily.startsAt.getTime() + 9 * 60 * 60 * 1000);
  if (period === "WEEKLY") {
    const mondayOffset = (localDate.getUTCDay() + 6) % 7;
    const startsAt = new Date(daily.startsAt);
    startsAt.setUTCDate(startsAt.getUTCDate() - mondayOffset);
    return { startsAt, endsAt: new Date(startsAt.getTime() + 7 * 86_400_000) };
  }
  if (period === "MONTHLY") {
    const year = localDate.getUTCFullYear();
    const month = localDate.getUTCMonth();
    const startsAt = new Date(Date.UTC(year, month, 0, 15, 30));
    const endsAt = new Date(Date.UTC(year, month + 1, 0, 15, 30));
    return { startsAt, endsAt };
  }
  throw new BadRequestException("Unsupported ranking period.");
}

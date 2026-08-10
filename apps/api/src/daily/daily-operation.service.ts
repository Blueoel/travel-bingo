import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";
import { getDailyCycle, toDatabaseDate } from "./daily-date.js";

const DAILY_LOCK_ID = 20_260_728_003;
const REWARD_BY_RANK: Readonly<Record<number, number>> = {
  1: 50,
  2: 30,
  3: 20,
};

@Injectable()
export class DailyOperationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async runDue(now = new Date()): Promise<{
    readonly date: string;
    readonly skipped: boolean;
    readonly rankingEntryCount: number;
    readonly rewardPointTotal: number;
  }> {
    const lock = await this.database.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${DAILY_LOCK_ID}) AS locked
    `;
    if (!lock[0]?.locked) {
      return {
        date: getDailyCycle(now).date,
        skipped: true,
        rankingEntryCount: 0,
        rewardPointTotal: 0,
      };
    }
    try {
      return await this.runLocked(now);
    } finally {
      await this.database.$queryRaw`
        SELECT pg_advisory_unlock(${DAILY_LOCK_ID})
      `;
    }
  }

  private async runLocked(now: Date) {
    const cycle = getDailyCycle(now);
    const cycleDate = toDatabaseDate(cycle.date);
    const existing = await this.database.dailyOperation.findUnique({
      where: { cycleDate },
    });
    if (existing?.status === "COMPLETED") {
      return {
        date: cycle.date,
        skipped: true,
        rankingEntryCount: existing.rankingEntryCount,
        rewardPointTotal: existing.rewardPointTotal,
      };
    }

    await this.database.dailyOperation.upsert({
      where: { cycleDate },
      update: { status: "PROCESSING", startedAt: now, lastError: null },
      create: { cycleDate, status: "PROCESSING", startedAt: now },
    });

    try {
      const result = await this.database.$transaction(async (transaction) => {
        const previousStartsAt = new Date(
          cycle.startsAt.getTime() - 24 * 60 * 60 * 1000,
        );
        const groupedScores = await transaction.pointLedger.groupBy({
          by: ["userId"],
          where: {
            createdAt: { gte: previousStartsAt, lt: cycle.startsAt },
            reason: { notIn: ["DAILY_RANK_REWARD", "DAILY_LUCKY"] },
          },
          _sum: { points: true },
        });
        const users = await transaction.user.findMany({
          where: {
            id: { in: groupedScores.map((entry) => entry.userId) },
            role: "USER",
            status: "ACTIVE",
          },
          select: { id: true },
        });
        const eligible = new Set(users.map((user) => user.id));
        const scores = groupedScores
          .map((entry) => ({
            userId: entry.userId,
            score: entry._sum.points ?? 0,
          }))
          .filter((entry) => eligible.has(entry.userId) && entry.score > 0)
          .sort((left, right) =>
            right.score === left.score
              ? left.userId.localeCompare(right.userId)
              : right.score - left.score,
          );

        let previousScore: number | undefined;
        let rank = 0;
        const rankings = scores.map((entry, index) => {
          if (entry.score !== previousScore) rank = index + 1;
          previousScore = entry.score;
          return {
            ...entry,
            rank,
            rewardPoints: REWARD_BY_RANK[rank] ?? 0,
          };
        });
        const rewardedRankings = rankings.filter((entry) => entry.rewardPoints > 0);
        const settlement = await transaction.rankingSettlement.upsert({
          where: { period_periodStart: { period: "DAILY", periodStart: previousStartsAt } },
          create: { period: "DAILY", periodStart: previousStartsAt, periodEnd: cycle.startsAt, status: "PROCESSING", startedAt: now },
          update: { status: "PROCESSING", startedAt: now, lastError: null },
        });
        if (rankings.length > 0) {
          await transaction.dailyRankingSnapshot.createMany({
            data: rankings.map((entry) => ({
              cycleDate: toDatabaseDate(
                getDailyCycle(new Date(cycle.startsAt.getTime() - 1)).date,
              ),
              ...entry,
            })),
            skipDuplicates: true,
          });
        }
        if (rewardedRankings.length > 0) {
          await transaction.rankingReward.createMany({
            data: rewardedRankings.map((entry) => ({ settlementId: settlement.id, userId: entry.userId, rank: entry.rank, score: entry.score, points: entry.rewardPoints })),
            skipDuplicates: true,
          });
          await transaction.pointLedger.createMany({
            data: rewardedRankings.map((entry) => ({
              userId: entry.userId,
              referenceType: "DAILY_RANKING",
              referenceId: `${settlement.id}:${entry.userId}`,
              reason: "DAILY_RANK_REWARD",
              points: entry.rewardPoints,
            })),
            skipDuplicates: true,
          });
        }

        const latestTemplate = await transaction.bingoTemplate.findFirst({
          where: { type: "DAILY" },
          orderBy: { version: "desc" },
          select: { regionId: true, themeId: true, version: true },
        });
        if (!latestTemplate) throw new Error("Daily base template not found.");
        const collection = await transaction.missionCollection.findFirst({
          where: { type: "DAILY", regionId: null, status: "ACTIVE" },
          include: {
            items: {
              where: { mission: { scope: "COMMON", status: "ACTIVE" } },
              include: { mission: { select: { id: true } } },
            },
          },
        });
        if (!collection || collection.items.length < 25) {
          throw new Error(
            "At least 25 active Daily candidate missions are required.",
          );
        }
        const missionIds = collection.items
          .map((item) => item.mission.id)
          .sort((left, right) =>
            dailyHash(cycle.date, left).localeCompare(
              dailyHash(cycle.date, right),
            ),
          )
          .slice(0, 25);

        await transaction.bingoTemplate.updateMany({
          where: {
            type: "DAILY",
            status: "PUBLISHED",
            OR: [{ endsAt: null }, { endsAt: { gt: cycle.startsAt } }],
          },
          data: { endsAt: cycle.startsAt },
        });
        const template = await transaction.bingoTemplate.create({
          data: {
            regionId: latestTemplate.regionId,
            themeId: latestTemplate.themeId,
            title: `${cycle.date} Daily 산책 빙고`,
            type: "DAILY",
            status: "PUBLISHED",
            version: latestTemplate.version + 1,
            startsAt: cycle.startsAt,
            endsAt: cycle.endsAt,
            publishedAt: now,
            cells: {
              create: missionIds.map((missionId, position) => ({
                missionId,
                position,
              })),
            },
          },
        });
        const rewardPointTotal = rankings.reduce(
          (total, entry) => total + entry.rewardPoints,
          0,
        );
        await transaction.rankingSettlement.update({
          where: { id: settlement.id },
          data: { status: "COMPLETED", participantCount: rankings.length, rewardCount: rewardedRankings.length, rewardPointTotal, completedAt: now },
        });
        await transaction.dailyOperation.update({
          where: { cycleDate },
          data: {
            status: "COMPLETED",
            templateId: template.id,
            rankingEntryCount: rankings.length,
            rewardPointTotal,
            completedAt: now,
          },
        });
        return {
          rankingEntryCount: rankings.length,
          rewardPointTotal,
        };
      });
      return { date: cycle.date, skipped: false, ...result };
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      const previousStartsAt = new Date(cycle.startsAt.getTime() - 24 * 60 * 60 * 1000);
      await this.database.dailyOperation.update({
        where: { cycleDate },
        data: {
          status: "FAILED",
          lastError,
        },
      });
      await this.database.rankingSettlement.upsert({
        where: { period_periodStart: { period: "DAILY", periodStart: previousStartsAt } },
        create: { period: "DAILY", periodStart: previousStartsAt, periodEnd: cycle.startsAt, status: "FAILED", startedAt: now, lastError },
        update: { status: "FAILED", lastError },
      });
      throw error;
    }
  }
}

function dailyHash(date: string, missionId: string): string {
  return createHash("sha256").update(`${date}:${missionId}`).digest("hex");
}

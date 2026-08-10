import { Inject, Injectable } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import { DATABASE_CLIENT } from "../database/database.module.js";
import { getDailyCycle } from "../daily/daily-date.js";

const REWARDS = {
  WEEKLY: { 1: 300, 2: 200, 3: 100 },
  MONTHLY: { 1: 1000, 2: 700, 3: 500 },
} as const;
const EXCLUDED_REASONS = ["DAILY_RANK_REWARD", "WEEKLY_RANK_REWARD", "MONTHLY_RANK_REWARD", "DAILY_LUCKY"];

@Injectable()
export class RankingSettlementService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async runDue(now = new Date()) {
    const windows = completedWindows(now);
    const results = [];
    for (const window of windows) results.push(await this.settle(window.period, window.startsAt, window.endsAt, now));
    return results;
  }

  async recent() {
    const rows = await this.db.rankingSettlement.findMany({ orderBy: { periodEnd: "desc" }, take: 20, include: { rewards: { orderBy: [{ rank: "asc" }, { score: "desc" }], include: { user: { select: { nickname: true, email: true } } } } } });
    return rows.map((row) => ({ ...row, rewards: row.rewards.map((reward) => ({ ...reward, user: reward.user })) }));
  }

  async rewards(userId: string) {
    const rows = await this.db.rankingReward.findMany({ where: { userId }, orderBy: { awardedAt: "desc" }, take: 30, include: { settlement: true } });
    return rows.map((row) => ({ id: row.id, period: row.settlement.period, rank: row.rank, score: row.score, points: row.points, awardedAt: row.awardedAt.toISOString(), isRead: row.readAt !== null }));
  }

  async markRead(userId: string, id: string) {
    const result = await this.db.rankingReward.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    return { read: result.count > 0 };
  }

  private async settle(period: "WEEKLY" | "MONTHLY", startsAt: Date, endsAt: Date, now: Date) {
    const existing = await this.db.rankingSettlement.findUnique({ where: { period_periodStart: { period, periodStart: startsAt } } });
    if (existing?.status === "COMPLETED") return { period, skipped: true, settlementId: existing.id };
    const settlement = await this.db.rankingSettlement.upsert({ where: { period_periodStart: { period, periodStart: startsAt } }, create: { period, periodStart: startsAt, periodEnd: endsAt, status: "PROCESSING", startedAt: now }, update: { status: "PROCESSING", startedAt: now, lastError: null } });
    try {
      return await this.db.$transaction(async (transaction) => {
        const grouped = await transaction.pointLedger.groupBy({ by: ["userId"], where: { createdAt: { gte: startsAt, lt: endsAt }, reason: { notIn: EXCLUDED_REASONS } }, _sum: { points: true } });
        const users = await transaction.user.findMany({ where: { id: { in: grouped.map((row) => row.userId) }, role: "USER", status: "ACTIVE" }, select: { id: true } });
        const eligible = new Set(users.map((user) => user.id));
        const scores = grouped.map((row) => ({ userId: row.userId, score: row._sum.points ?? 0 })).filter((row) => eligible.has(row.userId) && row.score > 0).sort((a, b) => b.score === a.score ? a.userId.localeCompare(b.userId) : b.score - a.score);
        let previousScore: number | undefined; let rank = 0;
        const ranked = scores.map((row, index) => { if (row.score !== previousScore) rank = index + 1; previousScore = row.score; return { ...row, rank }; });
        const rewardTable = REWARDS[period] as Record<number, number>;
        const rewards = ranked.filter((row) => row.rank <= 3).map((row) => ({ ...row, points: rewardTable[row.rank] ?? 0 })).filter((row) => row.points > 0);
        if (rewards.length) {
          await transaction.rankingReward.createMany({ data: rewards.map((row) => ({ settlementId: settlement.id, userId: row.userId, rank: row.rank, score: row.score, points: row.points })), skipDuplicates: true });
          await transaction.pointLedger.createMany({ data: rewards.map((row) => ({ userId: row.userId, referenceType: "RANKING_SETTLEMENT", referenceId: `${settlement.id}:${row.userId}`, reason: `${period}_RANK_REWARD`, points: row.points })), skipDuplicates: true });
        }
        const rewardPointTotal = rewards.reduce((sum, row) => sum + row.points, 0);
        await transaction.rankingSettlement.update({ where: { id: settlement.id }, data: { status: "COMPLETED", participantCount: ranked.length, rewardCount: rewards.length, rewardPointTotal, completedAt: now } });
        return { period, skipped: false, settlementId: settlement.id, participantCount: ranked.length, rewardCount: rewards.length, rewardPointTotal };
      });
    } catch (error) {
      await this.db.rankingSettlement.update({ where: { id: settlement.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }
}

function completedWindows(now: Date) {
  const boundary = getDailyCycle(now).startsAt;
  const seoulBoundary = new Date(boundary.getTime() + 9 * 60 * 60 * 1000);
  const mondayOffset = (seoulBoundary.getUTCDay() + 6) % 7;
  const currentWeekStart = new Date(boundary.getTime() - mondayOffset * 86_400_000);
  const year = seoulBoundary.getUTCFullYear();
  const month = seoulBoundary.getUTCMonth();
  const currentMonthStart = new Date(Date.UTC(year, month, 0, 15, 30));
  const previousMonthStart = new Date(Date.UTC(year, month - 1, 0, 15, 30));

  return [
    {
      period: "WEEKLY" as const,
      startsAt: new Date(currentWeekStart.getTime() - 7 * 86_400_000),
      endsAt: currentWeekStart,
    },
    {
      period: "MONTHLY" as const,
      startsAt: previousMonthStart,
      endsAt: currentMonthStart,
    },
  ];
}

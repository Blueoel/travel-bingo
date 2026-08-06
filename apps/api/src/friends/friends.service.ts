import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";
import { DATABASE_CLIENT } from "../database/database.module.js";

@Injectable()
export class FriendsService {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async list(userId: string): Promise<unknown> {
    const rows = await this.db.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: { select: { id: true, nickname: true, email: true } }, addressee: { select: { id: true, nickname: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      direction: row.requesterId === userId ? "SENT" : "RECEIVED",
      isUnread:
        row.requesterId === userId &&
        row.status === "ACCEPTED" &&
        row.requesterSeenAcceptedAt === null,
      updatedAt: row.updatedAt.toISOString(),
      user: row.requesterId === userId ? row.addressee : row.requester,
    }));
  }

  async listBlocks(userId: string): Promise<unknown> {
    return this.db.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, blocked: { select: { id: true, nickname: true } } },
    });
  }

  private async badgeState(userId: string) {
    const [points, completedMissions, completedBingos, completedRegions] =
      await Promise.all([
        this.db.pointLedger.aggregate({ where: { userId }, _sum: { points: true } }),
        this.db.sessionCell.count({
          where: { status: "VERIFIED", session: { userId } },
        }),
        this.db.bingoSession.count({
          where: { userId, status: { in: ["CLEAR", "PERFECT_CLEAR"] } },
        }),
        this.db.bingoSession.count({
          where: {
            userId,
            status: { in: ["CLEAR", "PERFECT_CLEAR"] },
            template: { type: "REGION" },
          },
        }),
      ]);
    const totals = {
      points: points._sum.points ?? 0,
      completedMissions,
      completedBingos,
      completedRegions,
    };
    const definitions = await this.db.badgeDefinition.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    const metricValues: Record<string, number> = {
      POINTS: totals.points,
      COMPLETED_MISSIONS: totals.completedMissions,
      COMPLETED_BINGOS: totals.completedBingos,
      COMPLETED_REGIONS: totals.completedRegions,
    };
    return { totals, definitions, metricValues };
  }

  private async synchronizeBadges(userId: string, announce: boolean) {
    const { totals, definitions, metricValues } = await this.badgeState(userId);
    const earnedRows = await this.db.userBadge.findMany({
      where: { userId },
      select: { badgeId: true, earnedAt: true, seenAt: true },
    });
    const earnedById = new Map(earnedRows.map((row) => [row.badgeId, row]));
    const newlyEligible = definitions.filter(
      (badge) =>
        !earnedById.has(badge.id) &&
        (metricValues[badge.metric] ?? 0) >= badge.target,
    );
    const now = new Date();
    if (newlyEligible.length) {
      await this.db.userBadge.createMany({
        data: newlyEligible.map((badge) => ({
          userId,
          badgeId: badge.id,
          earnedAt: now,
          seenAt: announce ? null : now,
        })),
        skipDuplicates: true,
      });
      for (const badge of newlyEligible) {
        earnedById.set(badge.id, {
          badgeId: badge.id,
          earnedAt: now,
          seenAt: announce ? null : now,
        });
      }
    }
    const serialize = (badge: (typeof definitions)[number]) => {
      const current = metricValues[badge.metric] ?? 0;
      const earned = earnedById.get(badge.id);
      return {
        id: badge.code,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        imageUrl: badge.imageUrl,
        current,
        earned: Boolean(earned),
        earnedAt: earned?.earnedAt.toISOString() ?? null,
        progress: Math.min(100, Math.round((current / badge.target) * 100)),
        target: badge.target,
      };
    };
    return {
      totals,
      badges: definitions.map(serialize),
      newlyEarned: announce ? newlyEligible.map(serialize) : [],
    };
  }

  async badges(userId: string): Promise<unknown> {
    return this.synchronizeBadges(userId, false);
  }

  async syncBadges(userId: string): Promise<unknown> {
    return this.synchronizeBadges(userId, true);
  }

  async badgeNotifications(userId: string): Promise<unknown> {
    const rows = await this.db.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.badge.code,
      title: row.badge.title,
      description: row.badge.description,
      icon: row.badge.icon,
      imageUrl: row.badge.imageUrl,
      earnedAt: row.earnedAt.toISOString(),
      isRead: row.seenAt !== null,
    }));
  }

  async markBadgeNotificationRead(userId: string, code: string): Promise<{ read: boolean }> {
    const badge = await this.db.badgeDefinition.findUnique({ where: { code }, select: { id: true } });
    if (!badge) throw new NotFoundException("Badge notification not found.");
    const result = await this.db.userBadge.updateMany({
      where: { userId, badgeId: badge.id },
      data: { seenAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Badge notification not found.");
    return { read: true };
  }

  async search(userId: string, q: string): Promise<unknown> {
    const query = q.trim();
    if (query.length < 2) return [];
    const connected = await this.db.friendship.findMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED"] },
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const connectedUserIds = connected.map((row) =>
      row.requesterId === userId ? row.addresseeId : row.requesterId,
    );
    const blocks = await this.db.userBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
    const blockedUserIds = blocks.map((row) => row.blockerId === userId ? row.blockedId : row.blockerId);
    return this.db.user.findMany({ where: { id: { notIn: [userId, ...connectedUserIds, ...blockedUserIds] }, status: "ACTIVE", role: "USER", OR: [{ nickname: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] }, select: { id: true, nickname: true, email: true }, take: 10 });
  }

  async profile(userId: string, friendUserId: string): Promise<unknown> {
    const friendship = await this.db.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: friendUserId },
          { requesterId: friendUserId, addresseeId: userId },
        ],
      },
      select: { id: true },
    });
    if (!friendship) throw new NotFoundException("Friend profile not found.");

    const [friend, points, completedMissions, completedBingos, recentCells] =
      await Promise.all([
        this.db.user.findFirst({
          where: { id: friendUserId, status: "ACTIVE" },
          select: { id: true, nickname: true, createdAt: true },
        }),
        this.db.pointLedger.aggregate({
          where: { userId: friendUserId },
          _sum: { points: true },
        }),
        this.db.sessionCell.count({
          where: { status: "VERIFIED", session: { userId: friendUserId } },
        }),
        this.db.bingoSession.count({
          where: {
            userId: friendUserId,
            status: { in: ["CLEAR", "PERFECT_CLEAR"] },
          },
        }),
        this.db.sessionCell.findMany({
          where: { status: "VERIFIED", session: { userId: friendUserId } },
          orderBy: { verifiedAt: "desc" },
          take: 3,
          select: { missionSnapshot: true, verifiedAt: true },
        }),
      ]);
    if (!friend) throw new NotFoundException("Friend profile not found.");

    return {
      id: friend.id,
      nickname: friend.nickname,
      joinedAt: friend.createdAt.toISOString(),
      totalPoints: points._sum.points ?? 0,
      completedMissions,
      completedBingos,
      recentActivity: recentCells.map((cell) => {
        const snapshot = cell.missionSnapshot as { title?: unknown };
        return {
          title: typeof snapshot.title === "string" ? snapshot.title : "미션 완료",
          completedAt: cell.verifiedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  async request(userId: string, addresseeId: string): Promise<unknown> {
    if (!addresseeId || addresseeId === userId) throw new BadRequestException("Invalid friend target.");
    const blocked = await this.db.userBlock.findFirst({ where: { OR: [{ blockerId: userId, blockedId: addresseeId }, { blockerId: addresseeId, blockedId: userId }] } });
    if (blocked) throw new BadRequestException("Friend request unavailable.");
    const reverse = await this.db.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId: addresseeId, addresseeId: userId } } });
    if (reverse?.status === "PENDING") return this.db.friendship.update({ where: { id: reverse.id }, data: { status: "ACCEPTED" } });
    if (reverse?.status === "ACCEPTED") return reverse;
    if (reverse?.status === "REJECTED") await this.db.friendship.delete({ where: { id: reverse.id } });
    const existing = await this.db.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId: userId, addresseeId } } });
    if (existing?.status === "ACCEPTED") return existing;
    return this.db.friendship.upsert({ where: { requesterId_addresseeId: { requesterId: userId, addresseeId } }, create: { requesterId: userId, addresseeId }, update: { status: "PENDING" } });
  }

  async decide(userId: string, id: string, accept: boolean): Promise<unknown> {
    const row = await this.db.friendship.findFirst({ where: { id, addresseeId: userId, status: "PENDING" } });
    if (!row) throw new NotFoundException("Friend request not found.");
    return this.db.friendship.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "REJECTED" } });
  }

  async markAcceptedRead(userId: string, id: string): Promise<{ read: boolean }> {
    const result = await this.db.friendship.updateMany({
      where: { id, requesterId: userId, status: "ACCEPTED" },
      data: { requesterSeenAcceptedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Friend notification not found.");
    return { read: true };
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const result = await this.db.friendship.deleteMany({ where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] } });
    if (!result.count) throw new NotFoundException("Friendship not found.");
    return { deleted: true };
  }

  async block(userId: string, blockedId: string): Promise<{ blocked: boolean }> {
    if (!blockedId || blockedId === userId) throw new BadRequestException("Invalid block target.");
    await this.db.$transaction(async (transaction) => {
      await transaction.friendship.deleteMany({ where: { OR: [{ requesterId: userId, addresseeId: blockedId }, { requesterId: blockedId, addresseeId: userId }] } });
      await transaction.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId } }, create: { blockerId: userId, blockedId }, update: {} });
    });
    return { blocked: true };
  }

  async report(userId: string, reportedId: string, reason: string, detail?: string): Promise<{ reported: boolean }> {
    const normalizedReason = reason.trim();
    if (!reportedId || reportedId === userId || normalizedReason.length < 2 || normalizedReason.length > 40) throw new BadRequestException("Invalid report.");
    await this.db.userReport.create({ data: { reporterId: userId, reportedId, reason: normalizedReason, detail: detail?.trim().slice(0, 500) || null } });
    return { reported: true };
  }

  async unblock(userId: string, id: string): Promise<{ unblocked: boolean }> {
    const result = await this.db.userBlock.deleteMany({ where: { id, blockerId: userId } });
    if (!result.count) throw new NotFoundException("Blocked user not found.");
    return { unblocked: true };
  }
}

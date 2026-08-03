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
    return rows.map((row) => ({ id: row.id, status: row.status, direction: row.requesterId === userId ? "SENT" : "RECEIVED", user: row.requesterId === userId ? row.addressee : row.requester }));
  }

  async search(userId: string, q: string): Promise<unknown> {
    const query = q.trim();
    if (query.length < 2) return [];
    return this.db.user.findMany({ where: { id: { not: userId }, status: "ACTIVE", role: "USER", OR: [{ nickname: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] }, select: { id: true, nickname: true, email: true }, take: 10 });
  }

  async request(userId: string, addresseeId: string): Promise<unknown> {
    if (!addresseeId || addresseeId === userId) throw new BadRequestException("Invalid friend target.");
    const reverse = await this.db.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId: addresseeId, addresseeId: userId } } });
    if (reverse) return this.db.friendship.update({ where: { id: reverse.id }, data: { status: "ACCEPTED" } });
    return this.db.friendship.upsert({ where: { requesterId_addresseeId: { requesterId: userId, addresseeId } }, create: { requesterId: userId, addresseeId }, update: { status: "PENDING" } });
  }

  async decide(userId: string, id: string, accept: boolean): Promise<unknown> {
    const row = await this.db.friendship.findFirst({ where: { id, addresseeId: userId, status: "PENDING" } });
    if (!row) throw new NotFoundException("Friend request not found.");
    return this.db.friendship.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "REJECTED" } });
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const result = await this.db.friendship.deleteMany({ where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] } });
    if (!result.count) throw new NotFoundException("Friendship not found.");
    return { deleted: true };
  }
}

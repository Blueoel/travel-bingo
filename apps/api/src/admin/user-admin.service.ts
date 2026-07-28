import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

type UserAction = "SUSPEND" | "ACTIVATE" | "WITHDRAW";
export interface UserAdminRecord {
  readonly id: string;
  readonly nickname: string;
  readonly email: string | null;
  readonly role: "USER" | "ADMIN";
  readonly status: "ACTIVE" | "SUSPENDED" | "DELETED";
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly _count: {
    readonly bingoSessions: number;
    readonly verifications: number;
  };
}
export interface UserAdminMutation {
  readonly id: string;
  readonly nickname: string;
  readonly email: string | null;
  readonly role: "USER" | "ADMIN";
  readonly status: "ACTIVE" | "SUSPENDED" | "DELETED";
  readonly updatedAt: Date;
}

@Injectable()
export class UserAdminService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async list(query: {
    q?: string;
    status?: string;
  }): Promise<{
    readonly items: UserAdminRecord[];
    readonly summary: {
      readonly total: number;
      readonly active: number;
      readonly suspended: number;
      readonly deleted: number;
    };
  }> {
    const status: "ACTIVE" | "SUSPENDED" | "DELETED" | undefined =
      query.status === "ACTIVE" ||
      query.status === "SUSPENDED" ||
      query.status === "DELETED"
        ? query.status
        : undefined;
    const q = query.q?.trim();
    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { nickname: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, active, suspended, deleted] = await Promise.all([
      this.database.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          nickname: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bingoSessions: true,
              verifications: true,
            },
          },
        },
      }),
      this.database.user.count({ where: { status: "ACTIVE" } }),
      this.database.user.count({ where: { status: "SUSPENDED" } }),
      this.database.user.count({ where: { status: "DELETED" } }),
    ]);
    return {
      items,
      summary: {
        total: active + suspended + deleted,
        active,
        suspended,
        deleted,
      },
    };
  }

  async updateStatus(
    userId: string,
    action: UserAction,
    administratorId: string,
  ): Promise<UserAdminMutation> {
    if (!["SUSPEND", "ACTIVATE", "WITHDRAW"].includes(action)) {
      throw new BadRequestException("지원하지 않는 사용자 관리 작업입니다.");
    }
    if (userId === administratorId) {
      throw new BadRequestException("현재 관리자 계정은 변경할 수 없습니다.");
    }
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");
    if (user.role === "ADMIN") {
      throw new BadRequestException("관리자 계정은 이 화면에서 변경할 수 없습니다.");
    }
    if (user.status === "DELETED") {
      throw new BadRequestException("이미 탈퇴 처리된 계정입니다.");
    }

    if (action === "WITHDRAW") {
      return this.database.$transaction(async (transaction) => {
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return transaction.user.update({
          where: { id: userId },
          data: {
            status: "DELETED",
            nickname: "탈퇴 회원",
            email: `deleted+${userId}@invalid.local`,
            passwordHash: null,
          },
          select: {
            id: true,
            nickname: true,
            email: true,
            role: true,
            status: true,
            updatedAt: true,
          },
        });
      });
    }

    const status = action === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
    return this.database.$transaction(async (transaction) => {
      if (status === "SUSPENDED") {
        await transaction.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return transaction.user.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          nickname: true,
          email: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });
    });
  }
}

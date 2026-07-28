import { createHash, randomBytes } from "node:crypto";

import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

export const AUTH_COOKIE_NAME = "travel_bingo_session";
export const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async createGuest(): Promise<{
    readonly token: string;
    readonly user: {
      readonly id: string;
      readonly nickname: string;
      readonly role: "USER" | "ADMIN";
    };
  }> {
    const token = randomBytes(32).toString("base64url");
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const user = await this.database.user.create({
      data: {
        nickname: `여행자 ${suffix}`,
        authSessions: {
          create: {
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + AUTH_SESSION_MAX_AGE_MS),
          },
        },
      },
      select: { id: true, nickname: true, role: true },
    });
    return { token, user };
  }

  async getUser(
    cookieHeader: string | undefined,
  ): Promise<{
    readonly id: string;
    readonly nickname: string;
    readonly role: "USER" | "ADMIN";
  } | null> {
    const token = readCookie(cookieHeader, AUTH_COOKIE_NAME);
    if (!token) return null;
    const session = await this.database.authSession.findFirst({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" },
      },
      include: { user: { select: { id: true, nickname: true, role: true } } },
    });
    return session?.user ?? null;
  }

  async requireUserId(
    cookieHeader: string | undefined,
    developmentUserId?: string,
  ): Promise<string> {
    const user = await this.getUser(cookieHeader);
    if (user) return user.id;
    if (process.env.NODE_ENV !== "production" && developmentUserId) {
      return developmentUserId;
    }
    throw new UnauthorizedException("A valid user session is required.");
  }

  async requireAdminId(
    cookieHeader: string | undefined,
    developmentUserId?: string,
  ): Promise<string> {
    const sessionUser = await this.getUser(cookieHeader);
    if (sessionUser) {
      if (sessionUser.role !== "ADMIN") {
        throw new ForbiddenException("Administrator access is required.");
      }
      return sessionUser.id;
    }

    if (process.env.NODE_ENV !== "production" && developmentUserId) {
      const user = await this.database.user.findUnique({
        where: { id: developmentUserId },
        select: { id: true, role: true, status: true },
      });
      if (user?.role === "ADMIN" && user.status === "ACTIVE") return user.id;
      throw new ForbiddenException("Administrator access is required.");
    }

    throw new UnauthorizedException("A valid administrator session is required.");
  }

  async revoke(cookieHeader: string | undefined): Promise<void> {
    const token = readCookie(cookieHeader, AUTH_COOKIE_NAME);
    if (!token) return;
    await this.database.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

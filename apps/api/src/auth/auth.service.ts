import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

export const AUTH_COOKIE_NAME = "travel_bingo_session";
export const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const scrypt = promisify(scryptCallback);

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
      readonly email: string | null;
      readonly role: "USER" | "ADMIN";
    };
  }> {
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const user = await this.database.user.create({
      data: {
        nickname: `여행자 ${suffix}`,
      },
      select: { id: true, nickname: true, email: true, role: true },
    });
    return this.createSession(user);
  }

  async register(input: {
    readonly name?: string;
    readonly email?: string;
    readonly password?: string;
  }): Promise<{
    readonly token: string;
    readonly user: {
      readonly id: string;
      readonly nickname: string;
      readonly email: string | null;
      readonly role: "USER" | "ADMIN";
    };
  }> {
    const nickname = input.name?.trim();
    const email = normalizeEmail(input.email);
    const password = input.password ?? "";
    if (!nickname || nickname.length > 40) {
      throw new BadRequestException("이름은 1~40자로 입력해주세요.");
    }
    if (!email || !email.includes("@")) {
      throw new BadRequestException("올바른 이메일 주소를 입력해주세요.");
    }
    if (password.length < 8) {
      throw new BadRequestException("비밀번호는 8자 이상이어야 합니다.");
    }
    if (await this.database.user.findUnique({ where: { email } })) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }
    const user = await this.database.user.create({
      data: {
        nickname,
        email,
        passwordHash: await hashPassword(password),
      },
      select: { id: true, nickname: true, email: true, role: true },
    });
    return this.createSession(user);
  }

  async login(input: {
    readonly email?: string;
    readonly password?: string;
  }): Promise<{
    readonly token: string;
    readonly user: {
      readonly id: string;
      readonly nickname: string;
      readonly email: string | null;
      readonly role: "USER" | "ADMIN";
    };
  }> {
    const email = normalizeEmail(input.email);
    const password = input.password ?? "";
    const account = email
      ? await this.database.user.findUnique({
          where: { email },
          select: {
            id: true,
            nickname: true,
            role: true,
            status: true,
            passwordHash: true,
          },
        })
      : null;
    if (
      !account?.passwordHash ||
      account.status !== "ACTIVE" ||
      !(await verifyPassword(password, account.passwordHash))
    ) {
      throw new UnauthorizedException(
        "이메일 주소 또는 비밀번호를 확인해주세요.",
      );
    }
    return this.createSession({
      id: account.id,
      nickname: account.nickname,
      email,
      role: account.role,
    });
  }

  async getUser(
    cookieHeader: string | undefined,
  ): Promise<{
    readonly id: string;
    readonly nickname: string;
    readonly email: string | null;
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
      include: {
        user: {
          select: { id: true, nickname: true, email: true, role: true },
        },
      },
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

  private async createSession(user: {
    readonly id: string;
    readonly nickname: string;
    readonly email: string | null;
    readonly role: "USER" | "ADMIN";
  }): Promise<{ readonly token: string; readonly user: typeof user }> {
    const token = randomBytes(32).toString("base64url");
    await this.database.authSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + AUTH_SESSION_MAX_AGE_MS),
      },
    });
    return { token, user };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(value?: string): string | null {
  const email = value?.trim().toLowerCase();
  return email && email.length <= 254 ? email : null;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, saltValue, hashValue] = storedHash.split(":");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = (await scrypt(
    password,
    Buffer.from(saltValue, "base64url"),
    expected.length,
  )) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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

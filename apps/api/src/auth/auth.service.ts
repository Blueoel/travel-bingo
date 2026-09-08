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
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { DatabaseClient } from "@travel-bingo/database";

import { DATABASE_CLIENT } from "../database/database.module.js";

export const AUTH_COOKIE_NAME = "travel_bingo_session";
export const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_MAX_AGE_MS = 30 * 60 * 1000;
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
      select: { id: true, nickname: true, email: true, role: true, avatarDataUrl: true },
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
      select: { id: true, nickname: true, email: true, role: true, avatarDataUrl: true },
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
            avatarDataUrl: true,
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
      avatarDataUrl: account.avatarDataUrl,
    });
  }

  async requestPasswordReset(rawEmail?: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if (!email || !email.includes("@")) {
      throw new BadRequestException("올바른 이메일 주소를 입력해주세요.");
    }
    const account = await this.database.user.findFirst({
      where: { email, status: "ACTIVE", passwordHash: { not: null } },
      select: { id: true, nickname: true, email: true },
    });
    if (!account?.email) return;

    const recent = await this.database.passwordResetToken.findFirst({
      where: {
        userId: account.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });
    if (recent) return;

    const token = randomBytes(32).toString("base64url");
    const record = await this.database.passwordResetToken.create({
      data: {
        userId: account.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_MAX_AGE_MS),
      },
      select: { id: true },
    });
    try {
      await sendPasswordResetEmail(account.email, account.nickname, token);
    } catch (error) {
      await this.database.passwordResetToken.delete({ where: { id: record.id } });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("재설정 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  }

  async confirmPasswordReset(token?: string, newPassword?: string): Promise<void> {
    if (!token || token.length < 32) {
      throw new BadRequestException("비밀번호 재설정 링크가 올바르지 않아요.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException("새 비밀번호는 8자 이상이어야 합니다.");
    }
    const record = await this.database.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" },
      },
      select: { id: true, userId: true, user: { select: { passwordHash: true } } },
    });
    if (!record?.user.passwordHash) {
      throw new BadRequestException("재설정 링크가 만료되었거나 이미 사용되었어요.");
    }
    if (await verifyPassword(newPassword, record.user.passwordHash)) {
      throw new BadRequestException("기존 비밀번호와 다른 비밀번호를 입력해주세요.");
    }
    const passwordHash = await hashPassword(newPassword);
    await this.database.$transaction([
      this.database.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.database.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.database.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async getUser(cookieHeader: string | undefined): Promise<{
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
          select: { id: true, nickname: true, email: true, role: true, avatarDataUrl: true },
        },
      },
    });
    if (session) {
      await this.database.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }
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

    const adminApiKey = process.env.ADMIN_API_KEY?.trim();
    if (
      adminApiKey &&
      developmentUserId &&
      safeSecretEqual(adminApiKey, developmentUserId)
    ) {
      const administrator = await this.database.user.findFirst({
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { id: true },
      });
      if (administrator) return administrator.id;
      throw new ForbiddenException("An active administrator is required.");
    }

    if (process.env.NODE_ENV !== "production" && developmentUserId) {
      const user = await this.database.user.findUnique({
        where: { id: developmentUserId },
        select: { id: true, role: true, status: true },
      });
      if (user?.role === "ADMIN" && user.status === "ACTIVE") return user.id;
      throw new ForbiddenException("Administrator access is required.");
    }

    throw new UnauthorizedException(
      "A valid administrator session is required.",
    );
  }

  async revoke(cookieHeader: string | undefined): Promise<void> {
    const token = readCookie(cookieHeader, AUTH_COOKIE_NAME);
    if (!token) return;
    await this.database.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateProfile(userId: string, input: { nickname?: string; avatarDataUrl?: string | null }): Promise<{
    readonly id: string;
    readonly nickname: string;
    readonly email: string | null;
    readonly role: "USER" | "ADMIN";
  }> {
    const nickname = input.nickname?.trim();
    if (!nickname || nickname.length > 40) {
      throw new BadRequestException("닉네임은 1~40자로 입력해주세요.");
    }
    const avatarDataUrl = input.avatarDataUrl;
    if (avatarDataUrl !== undefined && avatarDataUrl !== null && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatarDataUrl)) {
      throw new BadRequestException("프로필 사진 형식이 올바르지 않습니다.");
    }
    if (avatarDataUrl && avatarDataUrl.length > 350_000) {
      throw new BadRequestException("프로필 사진 용량이 너무 큽니다.");
    }
    return this.database.user.update({
      where: { id: userId },
      data: { nickname, ...(avatarDataUrl !== undefined ? { avatarDataUrl } : {}) },
      select: { id: true, nickname: true, email: true, role: true, avatarDataUrl: true },
    });
  }

  async updatePassword(
    userId: string,
    currentPassword?: string,
    newPassword?: string,
  ): Promise<void> {
    const account = await this.requirePasswordAccount(userId, currentPassword);
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException("새 비밀번호는 8자 이상이어야 합니다.");
    }
    if (await verifyPassword(newPassword, account.passwordHash)) {
      throw new BadRequestException("현재 비밀번호와 다른 비밀번호를 사용해주세요.");
    }
    await this.database.$transaction([
      this.database.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(newPassword) },
      }),
      this.database.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async deleteAccount(userId: string, currentPassword?: string): Promise<void> {
    await this.requirePasswordAccount(userId, currentPassword);
    await this.database.$transaction([
      this.database.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.database.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          email: null,
          passwordHash: null,
          nickname: "탈퇴한 여행자",
        },
      }),
    ]);
  }

  private async requirePasswordAccount(userId: string, password?: string): Promise<{ passwordHash: string }> {
    const account = await this.database.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!account?.passwordHash || !password || !(await verifyPassword(password, account.passwordHash))) {
      throw new UnauthorizedException("현재 비밀번호를 확인해주세요.");
    }
    return { passwordHash: account.passwordHash };
  }

  private async createSession(user: {
    readonly id: string;
    readonly nickname: string;
    readonly email: string | null;
    readonly role: "USER" | "ADMIN";
    readonly avatarDataUrl?: string | null;
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

function safeSecretEqual(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
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

async function sendPasswordResetEmail(email: string, nickname: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  const publicUrl = (process.env.PASSWORD_RESET_URL ?? "https://travel-bingo-walk.blueo03.chatgpt.site").trim();
  if (!apiKey || !from) {
    throw new ServiceUnavailableException("비밀번호 재설정 메일 서비스가 준비되지 않았어요.");
  }
  const resetUrl = new URL(publicUrl);
  resetUrl.searchParams.set("resetToken", token);
  const safeNickname = nickname.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Travel Bingo 비밀번호 재설정",
      html: `<div style="font-family:sans-serif;line-height:1.7;color:#203c2d"><h2>비밀번호를 다시 설정해주세요</h2><p>${safeNickname}님, 아래 버튼을 눌러 새 비밀번호를 설정할 수 있어요.</p><p><a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#174c38;color:#fff;text-decoration:none">비밀번호 재설정</a></p><p>이 링크는 30분 동안 한 번만 사용할 수 있어요. 요청하지 않았다면 이 메일을 무시해주세요.</p></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected password reset email: ${response.status}`);
}

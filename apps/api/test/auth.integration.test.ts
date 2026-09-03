import { resolve } from "node:path";

import {
  createDatabaseClient,
  type DatabaseClient,
} from "@travel-bingo/database";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AUTH_COOKIE_NAME, AuthService } from "../src/auth/auth.service.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("AuthService integration", () => {
  let database: DatabaseClient;
  let service: AuthService;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
    service = new AuthService(database);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await database.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await database.$disconnect();
  });

  it("creates, resolves, and revokes a hashed guest session", async () => {
    const created = await service.createGuest();
    createdUserIds.push(created.user.id);
    const cookie = `${AUTH_COOKIE_NAME}=${created.token}`;

    expect(await service.getUser(cookie)).toEqual(created.user);
    const stored = await database.authSession.findFirstOrThrow({
      where: { userId: created.user.id },
    });
    expect(stored.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      stored.createdAt.getTime(),
    );
    expect(stored.tokenHash).not.toContain(created.token);
    expect(stored.tokenHash).toHaveLength(64);

    await service.revoke(cookie);
    expect(await service.getUser(cookie)).toBeNull();
  });

  it("registers and signs in an email account with a hashed password", async () => {
    const email = `walk-${crypto.randomUUID()}@example.com`;
    const registered = await service.register({
      name: "산책친구",
      email,
      password: "walk-bingo-2026",
    });
    createdUserIds.push(registered.user.id);

    const stored = await database.user.findUniqueOrThrow({
      where: { email },
      select: { passwordHash: true },
    });
    expect(stored.passwordHash).not.toContain("walk-bingo-2026");

    const signedIn = await service.login({
      email: email.toUpperCase(),
      password: "walk-bingo-2026",
    });
    expect(signedIn.user.id).toBe(registered.user.id);
    await expect(
      service.login({ email, password: "incorrect-password" }),
    ).rejects.toThrow("이메일 주소 또는 비밀번호를 확인해주세요.");
  });

  it("updates profile credentials and soft-deletes an account", async () => {
    const email = `profile-${crypto.randomUUID()}@example.com`;
    const registered = await service.register({ name: "처음이름", email, password: "first-password" });
    createdUserIds.push(registered.user.id);

    const updated = await service.updateProfile(registered.user.id, { nickname: "새로운이름" });
    expect(updated.nickname).toBe("새로운이름");

    const secondarySession = await service.login({ email, password: "first-password" });
    await service.updatePassword(registered.user.id, "first-password", "second-password");
    expect(await service.getUser(`${AUTH_COOKIE_NAME}=${registered.token}`)).toBeNull();
    expect(await service.getUser(`${AUTH_COOKIE_NAME}=${secondarySession.token}`)).toBeNull();
    await expect(service.login({ email, password: "first-password" })).rejects.toThrow();
    const signedIn = await service.login({ email, password: "second-password" });
    expect(signedIn.user.id).toBe(registered.user.id);

    await service.deleteAccount(registered.user.id, "second-password");
    expect(await service.getUser(`${AUTH_COOKIE_NAME}=${signedIn.token}`)).toBeNull();
    await expect(service.login({ email, password: "second-password" })).rejects.toThrow();
    const deleted = await database.user.findUniqueOrThrow({ where: { id: registered.user.id } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.email).toBeNull();
    expect(deleted.passwordHash).toBeNull();
    expect(deleted.nickname).toBe("탈퇴한 여행자");
  });
});

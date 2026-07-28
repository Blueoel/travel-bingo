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
  let createdUserId: string | undefined;

  beforeAll(() => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
    service = new AuthService(database);
  });

  afterAll(async () => {
    if (createdUserId) {
      await database.user.delete({ where: { id: createdUserId } });
    }
    await database.$disconnect();
  });

  it("creates, resolves, and revokes a hashed guest session", async () => {
    const created = await service.createGuest();
    createdUserId = created.user.id;
    const cookie = `${AUTH_COOKIE_NAME}=${created.token}`;

    expect(await service.getUser(cookie)).toEqual(created.user);
    const stored = await database.authSession.findFirstOrThrow({
      where: { userId: created.user.id },
    });
    expect(stored.tokenHash).not.toContain(created.token);
    expect(stored.tokenHash).toHaveLength(64);

    await service.revoke(cookie);
    expect(await service.getUser(cookie)).toBeNull();
  });
});

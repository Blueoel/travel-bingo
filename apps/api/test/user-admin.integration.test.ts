import crypto from "node:crypto";
import { resolve } from "node:path";

import {
  createDatabaseClient,
  type DatabaseClient,
} from "@travel-bingo/database";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserAdminService } from "../src/admin/user-admin.service.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("UserAdminService integration", () => {
  let database: DatabaseClient;
  let service: UserAdminService;
  const userIds: string[] = [];
  let administratorId: string;
  let memberId: string;
  let memberEmail: string;

  beforeAll(async () => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
    service = new UserAdminService(database);
    const suffix = crypto.randomUUID();
    memberEmail = `member-${suffix}@example.com`;
    const [administrator, member] = await Promise.all([
      database.user.create({
        data: { nickname: "관리자 점검", role: "ADMIN" },
      }),
      database.user.create({
        data: {
          nickname: "사용자 점검",
          email: memberEmail,
          passwordHash: "scrypt:test:test",
          authSessions: {
            create: {
              tokenHash: crypto
                .createHash("sha256")
                .update(suffix)
                .digest("hex"),
              expiresAt: new Date(Date.now() + 60_000),
            },
          },
        },
      }),
    ]);
    administratorId = administrator.id;
    memberId = member.id;
    userIds.push(administrator.id, member.id);
  });

  afterAll(async () => {
    await database.user.deleteMany({ where: { id: { in: userIds } } });
    await database.$disconnect();
  });

  it("lists safe account fields and manages the account lifecycle", async () => {
    const listed = await service.list({ q: memberEmail });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).not.toHaveProperty("passwordHash");

    await service.updateStatus(memberId, "SUSPEND", administratorId);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: memberId } }),
    ).toMatchObject({ status: "SUSPENDED" });
    expect(
      await database.authSession.count({
        where: { userId: memberId, revokedAt: null },
      }),
    ).toBe(0);

    await service.updateStatus(memberId, "ACTIVATE", administratorId);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: memberId } }),
    ).toMatchObject({ status: "ACTIVE" });

    const withdrawn = await service.updateStatus(
      memberId,
      "WITHDRAW",
      administratorId,
    );
    expect(withdrawn).toMatchObject({
      status: "DELETED",
      nickname: "탈퇴 회원",
    });
    expect(withdrawn.email).not.toBe(memberEmail);
    const stored = await database.user.findUniqueOrThrow({
      where: { id: memberId },
      select: { passwordHash: true },
    });
    expect(stored.passwordHash).toBeNull();
  });
});

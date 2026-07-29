import { resolve } from "node:path";

import {
  createDatabaseClient,
  type DatabaseClient,
} from "@travel-bingo/database";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RankingService } from "../src/ranking/ranking.service.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("RankingService integration", () => {
  let database: DatabaseClient;
  let service: RankingService;
  const userIds: string[] = [];
  let regionId: string;
  let themeId: string;
  let templateId: string;
  const sessionIds: string[] = [];

  beforeAll(async () => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
    service = new RankingService(database);
    const suffix = crypto.randomUUID().slice(0, 8);
    const users = await Promise.all([
      database.user.create({ data: { nickname: `랭킹산책왕-${suffix}` } }),
      database.user.create({ data: { nickname: `랭킹걷기왕-${suffix}` } }),
    ]);
    userIds.push(...users.map((user) => user.id));
    const region = await database.region.create({
      data: {
        name: `랭킹 테스트 지역 ${suffix}`,
        administrativeCode: `ranking-${suffix}`,
        centerLatitude: 37.5,
        centerLongitude: 127,
      },
    });
    regionId = region.id;
    const theme = await database.bingoTheme.create({
      data: { regionId, name: `랭킹 테마 ${suffix}`, category: "DAILY" },
    });
    themeId = theme.id;
    const template = await database.bingoTemplate.create({
      data: {
        regionId,
        themeId,
        title: `랭킹 템플릿 ${suffix}`,
        type: "DAILY",
        status: "PUBLISHED",
        version: 800_000 + Math.floor(Math.random() * 10_000),
      },
    });
    templateId = template.id;
    for (const [index, user] of users.entries()) {
      const session = await database.bingoSession.create({
        data: {
          userId: user.id,
          templateId,
          idempotencyKey: `ranking-${suffix}-${index}`,
          dailyDate: new Date("2026-07-28T00:00:00.000Z"),
        },
      });
      sessionIds.push(session.id);
      await database.pointLedger.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          referenceType: "TEST",
          referenceId: `ranking-${suffix}-${index}`,
          reason: "MISSION_COMPLETED",
          points: index === 0 ? 200 : 100,
          createdAt: new Date("2026-07-28T03:00:00.000Z"),
        },
      });
      await database.pointLedger.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          referenceType: "DAILY_LUCKY",
          referenceId: `ranking-lucky-${suffix}-${index}`,
          reason: "DAILY_LUCKY",
          points: 50,
          createdAt: new Date("2026-07-28T03:00:00.000Z"),
        },
      });
    }
  });

  afterAll(async () => {
    await database.pointLedger.deleteMany({
      where: { userId: { in: userIds } },
    });
    await database.bingoSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    await database.bingoTemplate.delete({ where: { id: templateId } });
    await database.bingoTheme.delete({ where: { id: themeId } });
    await database.region.delete({ where: { id: regionId } });
    await database.user.deleteMany({ where: { id: { in: userIds } } });
    await database.$disconnect();
  });

  it("ranks common activity points and returns the current user", async () => {
    const result = await service.get(
      userIds[1]!,
      "DAILY",
      "COMMON",
      new Date("2026-07-28T05:00:00.000Z"),
    );
    const fixtures = result.entries.filter((entry) =>
      userIds.includes(entry.userId),
    );
    expect(fixtures.map((entry) => entry.points)).toEqual([200, 100]);
    expect(result.me?.userId).toBe(userIds[1]);
    expect(result.me?.points).toBe(100);
  });
});

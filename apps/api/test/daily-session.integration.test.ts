import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  createDatabaseClient,
  type DatabaseClient,
} from "@travel-bingo/database";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DailySessionService } from "../src/daily/daily-session.service.js";
import { MissionCompletionService } from "../src/daily/mission-completion.service.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("DailySessionService integration", () => {
  let database: DatabaseClient;
  let service: DailySessionService;
  let completionService: MissionCompletionService;
  let userId: string;
  let templateId: string;
  let themeId: string;
  let regionId: string;
  let missionIds: string[];

  beforeAll(async () => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
    service = new DailySessionService(database);
    completionService = new MissionCompletionService(database);

    const suffix = crypto.randomUUID().slice(0, 8);
    const fixture = await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { nickname: `daily-user-${suffix}` },
      });
      const region = await transaction.region.create({
        data: {
          name: `Daily 테스트 지역 ${suffix}`,
          administrativeCode: `daily-${suffix}`,
          centerLatitude: 37.5665,
          centerLongitude: 126.978,
        },
      });
      const theme = await transaction.bingoTheme.create({
        data: {
          regionId: region.id,
          name: `Daily 산책 ${suffix}`,
          category: "DAILY",
        },
      });
      const missions = await Promise.all(
        Array.from({ length: 25 }, (_, index) =>
          transaction.mission.create({
            data: {
              kind: "CHECK_IN",
              title: `공통 미션 ${index + 1}`,
              description: `Daily 테스트 미션 ${index + 1}`,
              category: "DAILY",
              verificationPolicy: { type: "CHECK_IN" },
              points: 10,
            },
          }),
        ),
      );
      const template = await transaction.bingoTemplate.create({
        data: {
          regionId: region.id,
          themeId: theme.id,
          title: `오늘의 산책 빙고 ${suffix}`,
          type: "DAILY",
          status: "PUBLISHED",
          version: 999_999,
          startsAt: new Date("2026-07-26T15:00:00.000Z"),
          endsAt: new Date("2026-07-27T15:00:00.000Z"),
          publishedAt: new Date("2026-07-26T14:00:00.000Z"),
          cells: {
            create: missions.map((mission, position) => ({
              missionId: mission.id,
              position,
            })),
          },
        },
      });

      return { user, region, theme, missions, template };
    });

    userId = fixture.user.id;
    regionId = fixture.region.id;
    themeId = fixture.theme.id;
    missionIds = fixture.missions.map((mission) => mission.id);
    templateId = fixture.template.id;
  });

  afterAll(async () => {
    const verificationIds = (
      await database.verification.findMany({
        where: { userId },
        select: { id: true },
      })
    ).map(({ id }) => id);
    await database.outboxEvent.deleteMany({
      where: { aggregateId: { in: verificationIds } },
    });
    await database.pointLedger.deleteMany({ where: { userId } });
    await database.bingoLineReward.deleteMany({
      where: { session: { userId } },
    });
    await database.verification.deleteMany({ where: { userId } });
    await database.bingoSession.deleteMany({ where: { templateId } });
    await database.bingoTemplate.delete({ where: { id: templateId } });
    await database.mission.deleteMany({ where: { id: { in: missionIds } } });
    await database.bingoTheme.delete({ where: { id: themeId } });
    await database.region.delete({ where: { id: regionId } });
    await database.user.delete({ where: { id: userId } });
    await database.$disconnect();
  });

  it("creates 25 personalized cells and returns the same Daily session", async () => {
    const now = new Date("2026-07-27T03:00:00.000Z");
    const first = await service.createOrGet({
      userId,
      idempotencyKey: `daily-first-${crypto.randomUUID()}`,
      now,
    });
    const second = await service.createOrGet({
      userId,
      idempotencyKey: `daily-retry-${crypto.randomUUID()}`,
      now,
    });

    expect(first.id).toBe(second.id);
    expect(first.date).toBe("2026-07-27");
    expect(first.layoutVariant).toBeGreaterThanOrEqual(0);
    expect(first.layoutVariant).toBeLessThanOrEqual(7);
    expect(first.cells).toHaveLength(25);
    expect(new Set(first.cells.map((cell) => cell.position)).size).toBe(25);
    expect(
      new Set(
        first.cells.map((cell) => (cell.mission as { readonly id: string }).id),
      ).size,
    ).toBe(25);

    const today = await service.getToday({ userId, now });
    expect(today.id).toBe(first.id);
    expect(today.cells).toHaveLength(25);
  });

  it("completes missions and awards a bingo line exactly once", async () => {
    const now = new Date("2026-07-27T03:00:00.000Z");
    const session = await service.getToday({ userId, now });

    let lastResult;
    for (const cell of session.cells.slice(0, 5)) {
      lastResult = await completionService.completeCheckIn({
        userId,
        sessionId: session.id,
        cellId: cell.id,
        idempotencyKey: `complete-${cell.id}`,
        now,
      });
    }

    expect(lastResult?.completedCellCount).toBe(5);
    expect(lastResult?.completedLineKeys).toContain("ROW_0");
    expect(lastResult?.pointsEarned).toBe(110);
    expect(lastResult?.totalPoints).toBe(150);

    const repeated = await completionService.completeCheckIn({
      userId,
      sessionId: session.id,
      cellId: session.cells[4]!.id,
      idempotencyKey: `complete-${session.cells[4]!.id}`,
      now,
    });
    expect(repeated.totalPoints).toBe(150);
    expect(repeated.pointsEarned).toBe(0);

    const [verifications, lineRewards, ledgerEntries, outboxEvents] =
      await Promise.all([
        database.verification.count({ where: { userId } }),
        database.bingoLineReward.count({ where: { sessionId: session.id } }),
        database.pointLedger.count({ where: { sessionId: session.id } }),
        database.outboxEvent.count({ where: { aggregateId: { not: "" } } }),
      ]);
    expect(verifications).toBe(5);
    expect(lineRewards).toBe(1);
    expect(ledgerEntries).toBe(6);
    expect(outboxEvents).toBeGreaterThanOrEqual(5);
  });

  it("rejects invalid quiz/GPS evidence and approves valid retries", async () => {
    const now = new Date("2026-07-27T03:00:00.000Z");
    const session = await service.getToday({ userId, now });
    const quizCell = session.cells[5]!;
    const gpsCell = session.cells[6]!;
    const answerHash = createHash("sha256").update("바우덕이").digest("hex");

    await Promise.all([
      database.sessionCell.update({
        where: { id: quizCell.id },
        data: {
          missionSnapshot: {
            kind: "QUIZ",
            title: "안성 역사 퀴즈",
            points: 20,
            verificationPolicy: { answerHash },
          },
        },
      }),
      database.sessionCell.update({
        where: { id: gpsCell.id },
        data: {
          missionSnapshot: {
            kind: "PLACE_VISIT",
            title: "안성 관광지 방문",
            points: 30,
            radiusM: 100,
            verificationPolicy: {
              maximumAccuracyM: 50,
              maximumAgeMs: 60_000,
            },
            place: { latitude: "37.000000", longitude: "127.000000" },
          },
        },
      }),
    ]);

    const wrongQuiz = await completionService.verify(
      {
        userId,
        sessionId: session.id,
        cellId: quizCell.id,
        idempotencyKey: `quiz-wrong-${quizCell.id}`,
        now,
      },
      { type: "QUIZ", answer: "오답" },
    );
    expect(wrongQuiz.verificationStatus).toBe("REJECTED");
    expect(wrongQuiz.reasonCode).toBe("QUIZ_INCORRECT");
    expect(wrongQuiz.pointsEarned).toBe(0);

    const correctQuiz = await completionService.verify(
      {
        userId,
        sessionId: session.id,
        cellId: quizCell.id,
        idempotencyKey: `quiz-correct-${quizCell.id}`,
        now,
      },
      { type: "QUIZ", answer: "  바우덕이  " },
    );
    expect(correctQuiz.verificationStatus).toBe("APPROVED");
    expect(correctQuiz.pointsEarned).toBe(20);

    const outsideGps = await completionService.verify(
      {
        userId,
        sessionId: session.id,
        cellId: gpsCell.id,
        idempotencyKey: `gps-outside-${gpsCell.id}`,
        now,
      },
      {
        type: "GPS",
        latitude: 37.01,
        longitude: 127,
        accuracyM: 10,
        measuredAt: new Date(now.getTime() - 5_000),
      },
    );
    expect(outsideGps.verificationStatus).toBe("REJECTED");
    expect(outsideGps.reasonCode).toBe("OUTSIDE_ALLOWED_RADIUS");

    const insideGps = await completionService.verify(
      {
        userId,
        sessionId: session.id,
        cellId: gpsCell.id,
        idempotencyKey: `gps-inside-${gpsCell.id}`,
        now,
      },
      {
        type: "GPS",
        latitude: 37.0001,
        longitude: 127.0001,
        accuracyM: 10,
        measuredAt: new Date(now.getTime() - 5_000),
      },
    );
    expect(insideGps.verificationStatus).toBe("APPROVED");
    expect(insideGps.pointsEarned).toBe(30);
    expect(insideGps.totalPoints).toBe(200);
  });
});

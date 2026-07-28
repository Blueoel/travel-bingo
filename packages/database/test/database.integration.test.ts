import { resolve } from "node:path";

import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient, type DatabaseClient } from "../src/index.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("database integration", () => {
  let database: DatabaseClient;

  beforeAll(() => {
    database = createDatabaseClient({ connectionString: databaseUrl! });
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("connects to PostgreSQL with PostGIS enabled", async () => {
    const rows = await database.$queryRaw<Array<{ version: string }>>`
      SELECT PostGIS_Version() AS version
    `;

    expect(rows[0]?.version).toContain("3.5");
  });

  it("enforces a unique administrative region code", async () => {
    const administrativeCode = `test-${crypto.randomUUID().slice(0, 8)}`;

    await database.region.create({
      data: {
        name: "테스트 지역",
        administrativeCode,
        centerLatitude: 37.5665,
        centerLongitude: 126.978,
      },
    });

    await expect(
      database.region.create({
        data: {
          name: "중복 테스트 지역",
          administrativeCode,
          centerLatitude: 37.5665,
          centerLongitude: 126.978,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await database.region.delete({ where: { administrativeCode } });
  });

  it("supports a walking mission without a place", async () => {
    const mission = await database.mission.create({
      data: {
        kind: "WALK_DISTANCE",
        title: "천 미터 걷기",
        description: "탐험 세션 중 천 미터를 걸어보세요.",
        category: "WALKING",
        verificationPolicy: {
          maximumSpeedKmh: 12,
          minimumAccuracyM: 50,
        },
        targetValue: 1000,
        targetUnit: "meters",
        points: 20,
      },
    });

    expect(mission.placeId).toBeNull();
    expect(mission.kind).toBe("WALK_DISTANCE");

    await database.mission.delete({ where: { id: mission.id } });
  });

  it("requires a place for a place visit mission", async () => {
    await expect(
      database.mission.create({
        data: {
          kind: "PLACE_VISIT",
          title: "장소 방문",
          description: "지정된 장소를 방문하세요.",
          category: "VISIT",
          verificationPolicy: {},
          radiusM: 100,
          points: 20,
        },
      }),
    ).rejects.toBeDefined();
  });
});

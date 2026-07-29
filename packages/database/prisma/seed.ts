import { createHash } from "node:crypto";

import { createDatabaseClient } from "../src/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const database = createDatabaseClient({ connectionString: databaseUrl });

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  admin: "10000000-0000-4000-8000-000000000002",
  region: "20000000-0000-4000-8000-000000000001",
  theme: "30000000-0000-4000-8000-000000000001",
  template: "40000000-0000-4000-8000-000000000001",
  collection: "70000000-0000-4000-8000-000000000001",
};

const places = [
  ["안성맞춤랜드", 37.0316, 127.3105],
  ["안성3·1운동기념관", 37.0628, 127.1779],
  ["안성팜랜드", 36.9912, 127.1938],
  ["칠장사", 37.0907, 127.4338],
  ["안성시립남사당바우덕이풍물단", 37.0319, 127.3109],
] as const;

const checkIns = [
  "산책 전 가볍게 스트레칭하기",
  "오늘의 산책 목표 정하기",
  "하늘 사진 한 장 남기기",
  "주변의 초록색 풍경 찾기",
  "평소와 다른 길로 걸어보기",
  "산책 중 벤치에서 잠시 쉬기",
  "주변 소리에 1분간 집중하기",
  "안전한 횡단보도 이용하기",
  "쓰레기 한 개 주워 버리기",
  "동네 간판 하나 관찰하기",
  "좋아하는 산책 음악 듣기",
  "물 한 잔 마시기",
  "오늘의 기분 기록하기",
  "산책 후 종아리 스트레칭하기",
  "내일 걷고 싶은 길 정하기",
] as const;

const additionalCheckIns = [
  "산책 중 둥근 모양 세 가지 찾기",
  "평소 지나치던 골목 한 곳 관찰하기",
  "오늘의 하늘을 한 문장으로 기록하기",
  "주변에서 계절의 흔적 하나 찾기",
  "안전한 장소에서 가볍게 스트레칭하기",
  "걷는 동안 고마웠던 일 하나 떠올리기",
] as const;

const dailyCheckIns = [...checkIns, ...additionalCheckIns] as const;

const quizzes = [
  ["안성의 대표 남사당 인물은?", "바우덕이"],
  ["안성이 속한 도는?", "경기도"],
  ["안성의 대표 농축산 체험 관광지는?", "안성팜랜드"],
  ["3·1운동기념관의 핵심 역사 주제는?", "독립운동"],
  ["칠장사의 시설 유형은?", "사찰"],
] as const;

const contributedMissions = [
  {
    title: "그림자를 따라",
    description: "오늘 가장 재미있는 그림자를 찾아 사진을 남겨보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    points: 20,
    difficulty: 2,
    estimatedMinutesMin: 10,
    estimatedMinutesMax: 10,
    similarityGroup: "SHADOW_OBSERVATION",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
    },
  },
  {
    title: "쉼표",
    description: "마음에 드는 장소를 발견했다면 10분 동안 머물러 보세요.",
    kind: "COMPOSITE" as const,
    category: "REST",
    points: 10,
    difficulty: 1,
    estimatedMinutesMin: 10,
    estimatedMinutesMax: 10,
    similarityGroup: "REST_STAY",
    targetValue: 600,
    targetUnit: "SECOND",
    verificationPolicy: {
      type: "GPS_STAY",
      durationSeconds: 600,
      allowedDriftM: 50,
    },
  },
  {
    title: "같은 색 세 장면",
    description:
      "산책 중 같은 색을 가진 서로 다른 대상 세 가지를 발견해보세요. 같은 물건을 반복 촬영하면 인정되지 않아요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION_COLLECTION",
    points: 20,
    difficulty: 2,
    estimatedMinutesMin: 10,
    estimatedMinutesMax: 20,
    similarityGroup: "COLOR_COLLECTION",
    targetValue: 3,
    targetUnit: "PHOTO",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 3,
      distinctSubjects: true,
    },
  },
  {
    title: "신호등 찾기",
    description: "신호등이 있는 교차로를 찾아 사진으로 남겨보세요.",
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    points: 10,
    difficulty: 1,
    estimatedMinutesMin: 3,
    estimatedMinutesMax: 3,
    similarityGroup: "ROAD_FACILITY",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
    },
  },
] as const;

function missionId(position: number): string {
  return `50000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
}

function placeId(position: number): string {
  return `60000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
}

function answerHash(answer: string): string {
  return createHash("sha256")
    .update(answer.trim().toLocaleLowerCase("ko-KR").normalize("NFC"))
    .digest("hex");
}

async function seed(): Promise<void> {
  await database.user.upsert({
    where: { id: ids.user },
    update: { nickname: "시연 사용자", status: "ACTIVE" },
    create: { id: ids.user, nickname: "시연 사용자" },
  });
  await database.user.upsert({
    where: { id: ids.admin },
    update: { nickname: "개발 관리자", role: "ADMIN", status: "ACTIVE" },
    create: {
      id: ids.admin,
      nickname: "개발 관리자",
      role: "ADMIN",
    },
  });
  await database.region.upsert({
    where: { id: ids.region },
    update: {
      name: "경기도 안성시",
      administrativeCode: "41550",
      centerLatitude: 37.008,
      centerLongitude: 127.2797,
    },
    create: {
      id: ids.region,
      name: "경기도 안성시",
      administrativeCode: "41550",
      centerLatitude: 37.008,
      centerLongitude: 127.2797,
    },
  });
  await database.bingoTheme.upsert({
    where: { id: ids.theme },
    update: { name: "Daily 산책 빙고", status: "ACTIVE" },
    create: {
      id: ids.theme,
      regionId: ids.region,
      name: "Daily 산책 빙고",
      category: "DAILY",
    },
  });

  for (const [index, [title, latitude, longitude]] of places.entries()) {
    await database.place.upsert({
      where: { id: placeId(index) },
      update: { title, latitude, longitude, status: "ACTIVE" },
      create: {
        id: placeId(index),
        regionId: ids.region,
        source: "DEMO",
        externalContentId: `demo-anseong-${index + 1}`,
        contentType: "TOURIST_SPOT",
        title,
        address: "경기도 안성시",
        latitude,
        longitude,
      },
    });
    await database.mission.upsert({
      where: { id: missionId(index) },
      update: {
        placeId: placeId(index),
        kind: "PLACE_VISIT",
        title: `${title} 방문하기`,
        verificationPolicy: {
          maximumAccuracyM: 50,
          maximumAgeMs: 60_000,
        },
        radiusM: 120,
      },
      create: {
        id: missionId(index),
        placeId: placeId(index),
        kind: "PLACE_VISIT",
        title: `${title} 방문하기`,
        description: `${title}의 120m 이내에서 위치를 인증해보세요.`,
        category: "PLACE",
        verificationPolicy: {
          maximumAccuracyM: 50,
          maximumAgeMs: 60_000,
        },
        radiusM: 120,
        points: 30,
        difficulty: 2,
      },
    });
  }

  for (const [index, [question, answer]] of quizzes.entries()) {
    const position = places.length + index;
    await database.mission.upsert({
      where: { id: missionId(position) },
      update: {
        kind: "QUIZ",
        title: question,
        verificationPolicy: { answerHash: answerHash(answer) },
      },
      create: {
        id: missionId(position),
        kind: "QUIZ",
        title: question,
        description: "안성에 관한 문제의 정답을 입력해보세요.",
        category: "QUIZ",
        verificationPolicy: { answerHash: answerHash(answer) },
        points: 20,
        difficulty: 1,
      },
    });
  }

  for (const [index, title] of dailyCheckIns.entries()) {
    const position =
      places.length + quizzes.length + contributedMissions.length + index;
    await database.mission.upsert({
      where: { id: missionId(position) },
      update: { kind: "CHECK_IN", title },
      create: {
        id: missionId(position),
        kind: "CHECK_IN",
        title,
        description: "미션을 수행한 뒤 완료 버튼을 눌러주세요.",
        category: "WALK",
        verificationPolicy: { type: "CHECK_IN" },
        points: 10,
        difficulty: 1,
      },
    });
  }

  for (const [index, mission] of contributedMissions.entries()) {
    const position = places.length + quizzes.length + index;
    await database.mission.upsert({
      where: { id: missionId(position) },
      update: mission,
      create: {
        id: missionId(position),
        ...mission,
      },
    });
  }

  const regionMissionIds = Array.from(
    { length: places.length + quizzes.length },
    (_, position) => missionId(position),
  );
  const commonMissionIds = Array.from(
    { length: contributedMissions.length + dailyCheckIns.length },
    (_, index) => missionId(places.length + quizzes.length + index),
  );
  await database.mission.updateMany({
    where: { id: { in: regionMissionIds } },
    data: { scope: "REGION" },
  });
  await database.mission.updateMany({
    where: { id: { in: commonMissionIds } },
    data: { scope: "COMMON" },
  });
  await database.missionRegion.createMany({
    data: regionMissionIds.map((missionIdValue) => ({
      missionId: missionIdValue,
      regionId: ids.region,
    })),
    skipDuplicates: true,
  });
  await database.missionCollection.upsert({
    where: { id: ids.collection },
    update: {
      name: "개발용 Daily 산책 미션",
      type: "DAILY",
      status: "ACTIVE",
    },
    create: {
      id: ids.collection,
      name: "개발용 Daily 산책 미션",
      type: "DAILY",
      description: "개인별 Daily 빙고판을 구성하는 개발용 미션 후보군",
    },
  });
  await database.missionCollectionItem.deleteMany({
    where: { collectionId: ids.collection },
  });
  await database.missionCollectionItem.createMany({
    data: commonMissionIds.map((missionIdValue, position) => ({
      collectionId: ids.collection,
      missionId: missionIdValue,
      displayOrder: position,
    })),
  });

  await database.bingoTemplate.upsert({
    where: { id: ids.template },
    update: {
      title: "오늘의 Daily 산책 빙고",
      status: "PUBLISHED",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: null,
      publishedAt: new Date(),
    },
    create: {
      id: ids.template,
      regionId: ids.region,
      themeId: ids.theme,
      title: "오늘의 Daily 산책 빙고",
      type: "DAILY",
      status: "PUBLISHED",
      version: 1,
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      publishedAt: new Date(),
    },
  });
  await database.templateCell.deleteMany({
    where: { templateId: ids.template },
  });
  await database.templateCell.createMany({
    data: Array.from({ length: 25 }, (_, position) => ({
      templateId: ids.template,
      missionId: missionId(position),
      position,
    })),
  });

  console.log(`Seed complete. Demo user: ${ids.user}`);
}

try {
  await seed();
} finally {
  await database.$disconnect();
}

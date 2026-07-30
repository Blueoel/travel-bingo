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
  regionTheme: "30000000-0000-4000-8000-000000000002",
  regionTemplate: "40000000-0000-4000-8000-000000000002",
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

const anseongExperienceMissions = [
  {
    title: "안성의 오늘 풍경",
    description:
      "지금 있는 안성의 풍경을 한 장 남겨보세요. 사람의 얼굴이나 차량번호가 나오지 않도록 촬영해주세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "안성 지역의 거리, 공원, 자연 또는 건축물이 담긴 풍경",
    },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_SCENERY",
  },
  {
    title: "안성맞춤 글자 찾기",
    description:
      "간판이나 안내판에서 '안성' 또는 '안성맞춤' 글자를 찾아 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "안성 또는 안성맞춤 글자가 보이는 간판이나 안내판",
    },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_SIGN",
  },
  {
    title: "안성의 농촌 풍경",
    description:
      "논, 밭, 과수원처럼 안성의 농촌 분위기를 느낄 수 있는 풍경을 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "NATURE",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "논, 밭, 과수원 등 농촌 풍경",
    },
    points: 20,
    difficulty: 2,
    similarityGroup: "ANSEONG_RURAL",
  },
  {
    title: "안성의 공공미술 찾기",
    description:
      "거리의 조형물, 벽화 또는 공공미술 작품을 찾아 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "CULTURE",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "공공 조형물, 벽화 또는 야외 미술 작품",
    },
    points: 20,
    difficulty: 2,
    similarityGroup: "ANSEONG_PUBLIC_ART",
  },
  {
    title: "안성 산책로 표지판",
    description:
      "공원이나 산책길의 안내 표지판을 찾아 주변 풍경과 함께 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "WALK",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "안성 지역 공원 또는 산책로 안내 표지판",
    },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_TRAIL_SIGN",
  },
  {
    title: "안성의 오래된 흔적",
    description:
      "오래된 건물, 비석, 전통 장식 등 시간의 흔적이 느껴지는 대상을 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "HISTORY",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "역사성이나 전통적인 특징이 보이는 건물, 비석 또는 장식",
    },
    points: 20,
    difficulty: 2,
    similarityGroup: "ANSEONG_HISTORY",
  },
  {
    title: "안성의 자연색 세 가지",
    description:
      "안성의 야외 공간에서 서로 다른 자연색 세 가지가 한 화면에 보이도록 촬영해보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "서로 구분되는 자연색 세 가지가 함께 담긴 야외 풍경",
    },
    points: 20,
    difficulty: 2,
    similarityGroup: "COLOR_COLLECTION",
  },
  {
    title: "다시 오고 싶은 안성의 장소",
    description:
      "오늘 다시 방문하고 싶다고 느낀 안성의 장소와 그 이유를 짧게 기록해보세요.",
    kind: "CHECK_IN" as const,
    category: "RECORD",
    verificationPolicy: { type: "TEXT", maxLength: 100 },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_TEXT_RECORD",
  },
  {
    title: "안성에서 발견한 한 문장",
    description:
      "안내판이나 간판에서 기억에 남는 문장을 찾아 100자 이내로 기록해보세요.",
    kind: "CHECK_IN" as const,
    category: "RECORD",
    verificationPolicy: { type: "TEXT", maxLength: 100 },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_TEXT_RECORD",
  },
  {
    title: "안성에서 5분 쉬어가기",
    description:
      "안전한 벤치나 쉼터에 머물며 주변 풍경을 5분 동안 천천히 감상해보세요.",
    kind: "CHECK_IN" as const,
    category: "REST",
    verificationPolicy: { type: "TIMER", durationSeconds: 300 },
    targetValue: 300,
    targetUnit: "SECOND",
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_TIMER",
  },
  {
    title: "안성길 10분 산책",
    description:
      "현재 있는 안성의 길을 안전하게 10분 동안 걸어보세요.",
    kind: "CHECK_IN" as const,
    category: "WALK",
    verificationPolicy: { type: "TIMER", durationSeconds: 600 },
    targetValue: 600,
    targetUnit: "SECOND",
    points: 20,
    difficulty: 2,
    similarityGroup: "ANSEONG_TIMER",
  },
  {
    title: "안성 관광 안내 확인하기",
    description:
      "주변 관광 안내판이나 온라인 관광 정보를 확인하고 완료 버튼을 눌러주세요.",
    kind: "CHECK_IN" as const,
    category: "EXPLORATION",
    verificationPolicy: { type: "CHECK_IN" },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_DISCOVERY",
  },
  {
    title: "안성의 안전한 보행로 찾기",
    description:
      "보도, 횡단보도 또는 산책로처럼 안전하게 걸을 수 있는 길을 찾아 걸어보세요.",
    kind: "CHECK_IN" as const,
    category: "SAFETY",
    verificationPolicy: { type: "CHECK_IN" },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_SAFETY",
  },
  {
    title: "안성에서 작은 친절 실천",
    description:
      "길을 양보하거나 주변을 정돈하는 등 여행지에서 할 수 있는 작은 친절을 실천해보세요.",
    kind: "CHECK_IN" as const,
    category: "COMMUNITY",
    verificationPolicy: { type: "CHECK_IN" },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_COMMUNITY",
  },
  {
    title: "안성 여행 한 줄 소감",
    description:
      "오늘 안성에서 느낀 점을 한 문장으로 기록해보세요.",
    kind: "CHECK_IN" as const,
    category: "RECORD",
    verificationPolicy: { type: "TEXT", maxLength: 100 },
    points: 10,
    difficulty: 1,
    similarityGroup: "ANSEONG_TRAVEL_NOTE",
  },
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
    difficulty: 3,
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

const colorPhotoMissions = [
  ["빨간색 찾기", "빨간색이 인상적인 대상을 찾아 사진으로 남겨보세요.", "RED"],
  [
    "주황색 찾기",
    "주황색이 인상적인 대상을 찾아 사진으로 남겨보세요.",
    "ORANGE",
  ],
  [
    "노란색 찾기",
    "노란색이 인상적인 대상을 찾아 사진으로 남겨보세요.",
    "YELLOW",
  ],
  [
    "초록색 찾기",
    "초록색이 인상적인 대상을 찾아 사진으로 남겨보세요.",
    "GREEN",
  ],
  ["파란색 찾기", "파란색이 인상적인 대상을 찾아 사진으로 남겨보세요.", "BLUE"],
  ["남색 찾기", "남색이 인상적인 대상을 찾아 사진으로 남겨보세요.", "NAVY"],
  [
    "보라색 찾기",
    "보라색이 인상적인 대상을 찾아 사진으로 남겨보세요.",
    "PURPLE",
  ],
] as const;

const spreadsheetMissions = [
  {
    title: "하늘",
    description:
      "오늘 하늘에서 가장 인상 깊은 모습을 찾아 사진으로 남겨보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    points: 10,
    difficulty: 1,
    similarityGroup: "SKY_OBSERVATION",
    status: "ACTIVE" as const,
    verificationPolicy: { type: "PHOTO", requiredPhotoCount: 1 },
  },
  ...colorPhotoMissions.map(([title, description, color]) => ({
    title,
    description,
    kind: "PHOTO" as const,
    category: "COLOR_OBSERVATION",
    points: 10,
    difficulty: 1,
    similarityGroup: "COLOR_SEARCH",
    status: "ACTIVE" as const,
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredColor: color,
    },
  })),
  ...[
    ["1km 걷기", 1, 10, 1],
    ["2km 걷기", 2, 20, 2],
    ["3km 걷기", 3, 30, 3],
  ].map(([title, kilometers, points, difficulty]) => ({
    title: String(title),
    description: `산책하며 총 ${kilometers}km를 걸어보세요.`,
    kind: "WALK_DISTANCE" as const,
    category: "WALK",
    points: Number(points),
    difficulty: Number(difficulty),
    targetValue: Number(kilometers),
    targetUnit: "KILOMETER",
    similarityGroup: "WALK_DISTANCE",
    status: "NEEDS_REVIEW" as const,
    verificationPolicy: {
      type: "GPS_DISTANCE",
      minimumKilometers: Number(kilometers),
    },
  })),
  ...[
    [
      "주차 금지 표지판 찾기",
      "주차 금지 표지판을 찾아 사진으로 남겨보세요.",
      "ROAD_SIGN",
    ],
    [
      "미끄럼틀 찾기",
      "산책 중 미끄럼틀을 찾아 사진으로 남겨보세요.",
      "PLAYGROUND",
    ],
    [
      "버스 찾기",
      "운행 중이거나 정차한 버스를 찾아 사진으로 남겨보세요.",
      "BUS",
    ],
    ["택시 찾기", "산책 중 택시를 찾아 사진으로 남겨보세요.", "TAXI"],
    ["맨홀 찾기", "길 위의 맨홀을 찾아 사진으로 남겨보세요.", "MANHOLE"],
  ].map(([title, description, subject]) => ({
    title,
    description,
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    points: 10,
    difficulty: 1,
    similarityGroup:
      subject === "BUS" || subject === "TAXI"
        ? "TRANSPORT_SEARCH"
        : "ROAD_FACILITY",
    status: "ACTIVE" as const,
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: subject,
    },
  })),
  {
    title: "막다른 길",
    description:
      "안전한 보행로에서 막다른 길 표지나 길의 끝을 찾아 사진으로 남겨보세요.",
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    points: 20,
    difficulty: 2,
    similarityGroup: "ROAD_END",
    status: "ACTIVE" as const,
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "DEAD_END",
    },
  },
  {
    title: "계절 한 스푼",
    description:
      "오늘 느낀 계절을 가장 잘 표현하는 장면을 사진으로 남겨보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    points: 20,
    difficulty: 2,
    similarityGroup: "SEASON_OBSERVATION",
    status: "ACTIVE" as const,
    verificationPolicy: { type: "PHOTO", requiredPhotoCount: 1 },
  },
  {
    title: "동네 최고 포토스팟",
    description:
      "'여기가 우리 동네에서 제일 예쁘다'고 생각하는 장소를 찾아 사진으로 남겨보세요.",
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    points: 10,
    difficulty: 1,
    similarityGroup: "LOCAL_PHOTO_SPOT",
    status: "ACTIVE" as const,
    verificationPolicy: { type: "PHOTO", requiredPhotoCount: 1 },
  },
] as const;

const workbookMissions = [
  {
    title: "그림자를 따라",
    description:
      "햇살 아래 만들어진 재미있는 그림자를 발견하고 사진을 남겨보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    difficulty: 2,
    similarityGroup: "SHADOW_OBSERVATION",
    verificationPolicy: { type: "PHOTO", requiredPhotoCount: 1 },
  },
  {
    title: "잠깐, 여기",
    description: '"여기 참 좋다."라는 생각이 드는 곳에서 잠시 머물러 보세요.',
    kind: "COMPOSITE" as const,
    category: "REST",
    difficulty: 1,
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
    category: "OBSERVATION",
    difficulty: 2,
    similarityGroup: "COLOR_SEARCH",
    targetValue: 3,
    targetUnit: "PHOTO",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 3,
      distinctSubjects: true,
    },
  },
  {
    title: "신호등",
    description: "신호등이 있는 교차로를 찾아보세요.",
    kind: "PHOTO" as const,
    category: "EXPLORATION",
    difficulty: 1,
    similarityGroup: "ROAD_FACILITY",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "TRAFFIC_LIGHT",
    },
  },
  {
    title: "고개를 들어",
    description: "오늘 하늘에서 가장 인상 깊은 모습을 찾아 사진을 남겨보세요.",
    kind: "PHOTO" as const,
    category: "OBSERVATION",
    difficulty: 1,
    similarityGroup: "SKY_OBSERVATION",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredSubject: "SKY",
    },
  },
  ...[
    [
      "빨강 한 조각",
      "빨간색이 가장 돋보이는 장면을 찾아 사진으로 남겨보세요.",
      "RED",
      1,
    ],
    [
      "주황빛 발견",
      "주황색이 눈에 띄는 풍경이나 사물을 찾아보세요.",
      "ORANGE",
      1,
    ],
    [
      "노랑을 찾아서",
      "노란색을 가장 예쁘게 담아 사진으로 남겨보세요.",
      "YELLOW",
      1,
    ],
    ["초록을 기록해", "자연 또는 도시 속 초록빛을 찾아보세요.", "GREEN", 1],
    ["파랑 수집가", "오늘 가장 시원한 파란색을 찾아보세요.", "BLUE", 1],
    ["깊은 푸름", "깊은 남색이 보이는 장면을 발견해 보세요.", "NAVY", 2],
    ["보랏빛 순간", "보라색이 담긴 풍경이나 사물을 찾아보세요.", "PURPLE", 2],
  ].map(([title, description, requiredColor, difficulty]) => ({
    title: String(title),
    description: String(description),
    kind: "PHOTO" as const,
    category: "COLOR",
    difficulty: Number(difficulty),
    similarityGroup: "COLOR_SEARCH",
    verificationPolicy: {
      type: "PHOTO",
      requiredPhotoCount: 1,
      requiredColor: String(requiredColor),
    },
  })),
  ...[
    ["가볍게 1Km", "1km를 걸으며 오늘의 첫 발걸음을 기록해 보세요.", 1, 1],
    ["산뜻하게 2Km", "2km를 걸으며 주변 풍경도 함께 즐겨보세요.", 2, 2],
    [
      "룰루랄라 3Km",
      "3km 산책에 도전해 오늘의 즐거운 탐험을 완성해 보세요.",
      3,
      3,
    ],
  ].map(([title, description, kilometers, difficulty]) => ({
    title: String(title),
    description: String(description),
    kind: "WALK_DISTANCE" as const,
    category: "EXPLORATION",
    difficulty: Number(difficulty),
    targetValue: Number(kilometers),
    targetUnit: "KILOMETER",
    similarityGroup: "WALK_DISTANCE",
    verificationPolicy: {
      type: "GPS_DISTANCE",
      minimumKilometers: Number(kilometers),
    },
  })),
  ...[
    [
      "주차 금지 표지판",
      "주차 금지 표지판을 찾아보세요.",
      "ROAD_FACILITY",
      "NO_PARKING_SIGN",
      1,
    ],
    [
      "놀이터의 주인공",
      "놀이터의 미끄럼틀을 찾아 사진으로 기록해 보세요.",
      "PLAYGROUND",
      "SLIDE",
      1,
    ],
    [
      "버스",
      "버스를 발견하고 오늘의 거리 풍경을 남겨보세요.",
      "TRANSPORT_SEARCH",
      "BUS",
      1,
    ],
    [
      "택시",
      "노란 택시 또는 지역 택시를 찾아보세요.",
      "TRANSPORT_SEARCH",
      "TAXI",
      1,
    ],
    [
      "맨홀",
      "맨홀 뚜껑을 찾아 사진으로 남겨보세요.",
      "ROAD_FACILITY",
      "MANHOLE",
      1,
    ],
    [
      "막다른 길",
      "골목 끝, 막다른 길에서만 볼 수 있는 풍경을 찾아보세요.",
      "ALLEY_END",
      "DEAD_END",
      1,
    ],
    [
      "계절 한 스푼",
      "오늘 느낀 계절을 가장 잘 표현하는 장면을 사진으로 남겨보세요.",
      "SEASON_OBSERVATION",
      "SEASON",
      1,
    ],
    [
      "동네 최고 포토스팟",
      "'여기가 우리 동네에서 제일 예쁘다'고 생각하는 장소를 찾아보세요.",
      "LOCAL_PHOTO_SPOT",
      "LOCAL_PHOTO_SPOT",
      1,
    ],
    [
      "웃긴 간판 찾기",
      "피식 웃음이 나는 간판을 발견해 보세요.",
      "SIGN_OBSERVATION",
      "FUNNY_SIGN",
      1,
    ],
    [
      "오래된 흔적",
      "오래된 건물이나 시간을 느낄 수 있는 것을 찾아보세요.",
      "OLD_TRACE",
      "OLD_BUILDING_OR_OBJECT",
      2,
    ],
    [
      "숫자 7 찾기",
      "주변에서 숫자 '7'이 적힌 곳을 찾아보세요.",
      "NUMBER_SEARCH",
      "NUMBER_7",
      2,
    ],
    [
      "특이한 문 찾기",
      "독특한 색이나 디자인의 문을 찾아보세요.",
      "DOOR_OBSERVATION",
      "UNUSUAL_DOOR",
      1,
    ],
    [
      "오늘의 색",
      "오늘 가장 눈에 들어온 색을 찾아 사진으로 남겨보세요.",
      "COLOR_SEARCH",
      "DOMINANT_COLOR",
      1,
    ],
    [
      "골목 끝에서",
      "골목 끝까지 걸어가 그곳에서만 만날 수 있는 풍경을 찾아보세요.",
      "ALLEY_END",
      "ALLEY_END_VIEW",
      2,
    ],
  ].map(
    ([title, description, similarityGroup, requiredSubject, difficulty]) => ({
      title: String(title),
      description: String(description),
      kind: "PHOTO" as const,
      category: "OBSERVATION",
      difficulty: Number(difficulty),
      similarityGroup: String(similarityGroup),
      verificationPolicy: {
        type: "PHOTO",
        requiredPhotoCount: 1,
        requiredSubject: String(requiredSubject),
      },
    }),
  ),
  ...[
    ["발자국 하나", "10분 동안 걷고 오늘의 걸음을 시작해 보세요.", 10, 1],
    ["발걸음 수집", "20분 동안 걷고 오늘의 산책을 완성해 보세요.", 20, 2],
    ["길 위의 시간", "30분 동안 걷고 오늘의 시간을 기록해 보세요.", 30, 3],
  ].map(([title, description, minutes, difficulty]) => ({
    title: String(title),
    description: String(description),
    kind: "COMPOSITE" as const,
    category: "EXPLORATION",
    difficulty: Number(difficulty),
    targetValue: Number(minutes) * 60,
    targetUnit: "SECOND",
    similarityGroup: "WALK_TIME",
    verificationPolicy: {
      type: "GPS_DURATION",
      minimumSeconds: Number(minutes) * 60,
    },
  })),
  ...[
    [
      "바람의 흔적",
      "나뭇잎, 깃발, 풀잎처럼 바람에 흔들리는 장면을 찾아보세요.",
      "OBSERVATION",
      2,
      "WIND_OBSERVATION",
      "WIND_MOVEMENT",
    ],
    [
      "조화로움",
      "한쪽은 자연, 한쪽은 도시가 담긴 장면을 찾아보세요.",
      "EXPLORATION",
      2,
      "COMPOSITION_OBSERVATION",
      "NATURE_AND_CITY",
    ],
    [
      "겹쳐진 순간",
      "서로 다른 사물이나 풍경이 재미있게 겹쳐 보이는 장면을 담아보세요.",
      "OBSERVATION",
      2,
      "COMPOSITION_OBSERVATION",
      "OVERLAPPING_SCENE",
    ],
    [
      "나란히 나란히",
      "비슷한 사물 두 개가 나란히 놓인 모습을 찾아보세요.",
      "OBSERVATION",
      1,
      "COMPOSITION_OBSERVATION",
      "SIDE_BY_SIDE_OBJECTS",
    ],
    [
      "아주 가까이",
      "거리의 익숙한 사물을 가까이에서 바라보고 새로운 모습으로 남겨보세요.",
      "OBSERVATION",
      1,
      "PERSPECTIVE_OBSERVATION",
      "CLOSE_UP_OBJECT",
    ],
    [
      "멀리 바라보기",
      "시야가 탁 트인 장소에서 멀리 보이는 풍경을 담아보세요.",
      "OBSERVATION",
      1,
      "PERSPECTIVE_OBSERVATION",
      "DISTANT_VIEW",
    ],
    [
      "거꾸로 세상",
      "물이나 유리 등에 비친 거꾸로 된 풍경을 발견해 보세요.",
      "OBSERVATION",
      2,
      "REFLECTION_OBSERVATION",
      "UPSIDE_DOWN_REFLECTION",
    ],
    [
      "거울로 본 세상",
      "반사되는 표면 속에 담긴 거리 풍경을 촬영해 보세요.",
      "OBSERVATION",
      2,
      "REFLECTION_OBSERVATION",
      "REFLECTED_STREET",
    ],
    [
      "틈새의 초록",
      "벽이나 보도블록 틈에서 자라는 식물을 찾아보세요.",
      "OBSERVATION",
      1,
      "PLANT_OBSERVATION",
      "PLANT_IN_CRACK",
    ],
    [
      "나뭇잎 한 장",
      "마음에 드는 모양이나 색을 가진 나뭇잎을 찾아 기록해 보세요.",
      "EXPLORATION",
      1,
      "PLANT_OBSERVATION",
      "LEAF",
    ],
    [
      "작은 숲 하나",
      "여러 식물이 모여 작은 숲처럼 보이는 장소를 찾아보세요.",
      "EXPLORATION",
      3,
      "PLANT_OBSERVATION",
      "SMALL_FOREST",
    ],
    [
      "오늘의 온도",
      "오늘의 공기와 온도가 느껴지는 풍경을 골라 기록해 보세요.",
      "OBSERVATION",
      2,
      "WEATHER_OBSERVATION",
      "TEMPERATURE_SCENE",
    ],
    [
      "빛이 머문 곳",
      "햇빛이나 조명이 예쁘게 내려앉은 장소를 찾아보세요.",
      "EXPLORATION",
      2,
      "LIGHT_OBSERVATION",
      "LIGHTED_PLACE",
    ],
    [
      "반짝임 수집",
      "빛을 받아 반짝이는 물체나 풍경을 발견해 보세요.",
      "OBSERVATION",
      2,
      "LIGHT_OBSERVATION",
      "SPARKLING_OBJECT",
    ],
    [
      "대칭의 순간",
      "좌우가 비슷하게 마주 보는 풍경이나 사물을 찾아보세요.",
      "EXPLORATION",
      3,
      "COMPOSITION_OBSERVATION",
      "SYMMETRY",
    ],
  ].map(
    ([
      title,
      description,
      category,
      difficulty,
      similarityGroup,
      requiredSubject,
    ]) => ({
      title: String(title),
      description: String(description),
      kind: "PHOTO" as const,
      category: String(category),
      difficulty: Number(difficulty),
      similarityGroup: String(similarityGroup),
      verificationPolicy: {
        type: "PHOTO",
        requiredPhotoCount: 1,
        requiredSubject: String(requiredSubject),
      },
    }),
  ),
  {
    title: "잠깐의 스트레칭",
    description: "안전한 장소에 멈춰 가볍게 몸을 풀어보세요.",
    kind: "CHECK_IN" as const,
    category: "REST",
    difficulty: 1,
    targetValue: 180,
    targetUnit: "SECOND",
    similarityGroup: "REST_ACTION",
    verificationPolicy: { type: "TIMER", durationSeconds: 180 },
  },
  {
    title: "지금, 당신의 기분",
    description: "지금의 기분을 한 단어나 짧은 문장으로 남겨보세요.",
    kind: "CHECK_IN" as const,
    category: "RECORD",
    difficulty: 1,
    similarityGroup: "TEXT_RECORD",
    verificationPolicy: { type: "TEXT", maxLength: 100 },
  },
  {
    title: "길 위의 글자",
    description: "거리에서 마음에 드는 글자나 문구를 하나 찾아 기록해 보세요.",
    kind: "CHECK_IN" as const,
    category: "EXPLORATION",
    difficulty: 1,
    similarityGroup: "TEXT_RECORD",
    verificationPolicy: { type: "TEXT", maxLength: 100 },
  },
].map((mission) => ({
  ...mission,
  points: mission.difficulty === 3 ? 30 : mission.difficulty === 2 ? 20 : 10,
  status: "ACTIVE" as const,
}));

function missionId(position: number): string {
  return `50000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
}

function placeId(position: number): string {
  return `60000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
}

function workbookMissionId(position: number): string {
  if (position < contributedMissions.length) {
    return missionId(places.length + quizzes.length + position);
  }
  return missionId(
    places.length +
      quizzes.length +
      contributedMissions.length +
      dailyCheckIns.length +
      position -
      contributedMissions.length,
  );
}

function anseongExperienceMissionId(position: number): string {
  return `80000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;
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

  for (const [index, mission] of anseongExperienceMissions.entries()) {
    await database.mission.upsert({
      where: { id: anseongExperienceMissionId(index) },
      update: {
        ...mission,
        scope: "REGION",
        status: "ACTIVE",
      },
      create: {
        id: anseongExperienceMissionId(index),
        ...mission,
        scope: "REGION",
        status: "ACTIVE",
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

  for (const [index, mission] of workbookMissions
    .slice(0, contributedMissions.length)
    .entries()) {
    await database.mission.upsert({
      where: { id: workbookMissionId(index) },
      update: mission,
      create: {
        id: workbookMissionId(index),
        ...mission,
      },
    });
  }

  for (const [index, mission] of workbookMissions
    .slice(contributedMissions.length)
    .entries()) {
    const workbookPosition = contributedMissions.length + index;
    await database.mission.upsert({
      where: { id: workbookMissionId(workbookPosition) },
      update: mission,
      create: {
        id: workbookMissionId(workbookPosition),
        ...mission,
      },
    });
  }

  const regionMissionIds = [
    ...Array.from(
      { length: places.length + quizzes.length },
      (_, position) => missionId(position),
    ),
    ...anseongExperienceMissions.map((_, position) =>
      anseongExperienceMissionId(position),
    ),
  ];
  if (regionMissionIds.length !== 25) {
    throw new Error(
      `Anseong region board requires exactly 25 missions; received ${regionMissionIds.length}.`,
    );
  }
  const commonMissionIds = workbookMissions.map((_, index) =>
    workbookMissionId(index),
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
  await database.bingoTheme.upsert({
    where: { id: ids.regionTheme },
    update: {
      name: "안성 실전 여행 빙고",
      category: "REGION",
      status: "ACTIVE",
      isRequiredForRegionCompletion: true,
    },
    create: {
      id: ids.regionTheme,
      regionId: ids.region,
      name: "안성 실전 여행 빙고",
      category: "REGION",
      status: "ACTIVE",
      isRequiredForRegionCompletion: true,
      displayOrder: 1,
    },
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

  await database.bingoTemplate.upsert({
    where: { id: ids.regionTemplate },
    update: {
      title: "안성 여행 빙고",
      type: "REGION",
      status: "PUBLISHED",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: null,
      publishedAt: new Date(),
    },
    create: {
      id: ids.regionTemplate,
      regionId: ids.region,
      themeId: ids.regionTheme,
      title: "안성 여행 빙고",
      type: "REGION",
      status: "PUBLISHED",
      version: 1,
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      publishedAt: new Date(),
    },
  });
  await database.templateCell.deleteMany({
    where: { templateId: ids.regionTemplate },
  });
  await database.templateCell.createMany({
    data: regionMissionIds.map((missionIdValue, position) => ({
      templateId: ids.regionTemplate,
      missionId: missionIdValue,
      position,
    })),
  });

  console.log(
    `Seed complete. Demo user: ${ids.user}; Anseong region board: ${regionMissionIds.length} missions`,
  );
}

try {
  await seed();
} finally {
  await database.$disconnect();
}

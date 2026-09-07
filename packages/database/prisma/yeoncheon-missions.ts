export const yeoncheonMissionSeed = [
  {
    "order": 1,
    "title": "아주아주 오래전",
    "description": "전곡리 유적에 도착해 아주 오래전 연천으로 여행을 시작해 보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_01",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000,
      "caution": "행사일 혼잡 가능"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "연천 전곡리 유적",
    "address": "경기도 연천군 전곡읍 양연로 1510",
    "latitude": 38.0116,
    "longitude": 127.0638
  },
  {
    "order": 2,
    "title": "선사인의 발걸음",
    "description": "전곡리 유적을 천천히 걸으며 선사시대의 공간을 둘러보세요.",
    "category": "걷기",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_02",
    "status": "ACTIVE",
    "kind": "WALK_DISTANCE",
    "verificationPolicy": {
      "type": "GPS_DISTANCE",
      "minimumKilometers": 1.0,
      "caution": "탐방 가능 구역 이용"
    },
    "targetValue": 1.0,
    "targetUnit": "KILOMETER",
    "placeTitle": "연천 전곡리 유적",
    "address": "경기도 연천군 전곡읍 양연로 1510",
    "latitude": 38.0116,
    "longitude": 127.0638
  },
  {
    "order": 3,
    "title": "주먹 속의 돌",
    "description": "Quiz! 동아시아 선사 연구의 흐름을 바꾼 전곡리의 대표 석기는 무엇일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_03",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answerHash": "99d458a71d83b177d204530c15b8e10fb17201099a1ba7385f478622445553f9",
      "choices": ["①뼈바늘", "②주먹도끼", "③빗살무늬토기", "④가락바퀴"]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 4,
    "title": "선사시대 산책",
    "description": "전곡리 유적에서 20분 이상 머물며 천천히 둘러보세요.",
    "category": "체류·탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_04",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "GPS_STAY",
      "minimumSeconds": 1200,
      "allowedDriftM": 100
    },
    "targetValue": 1200,
    "targetUnit": "SECOND",
    "placeTitle": "연천 전곡리 유적",
    "address": "경기도 연천군 전곡읍 양연로 1510",
    "latitude": 38.0116,
    "longitude": 127.0638
  },
  {
    "order": 5,
    "title": "선사시대 한 컷",
    "description": "전곡리 유적에서 현대적인 물건이 최대한 보이지 않는 장면을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_05",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true,
      "caution": "출입 가능 구역에서 촬영"
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천 전곡리 유적",
    "address": "경기도 연천군 전곡읍 양연로 1510",
    "latitude": 38.0116,
    "longitude": 127.0638
  },
  {
    "order": 6,
    "title": "돌멩이의 얼굴",
    "description": "전곡선사박물관에서 가장 독특하다고 느껴지는 석기 하나를 골라 기록해보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_06",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "전곡선사박물관",
    "address": "경기도 연천군 전곡읍 평화로443번길 2",
    "latitude": 38.0115717,
    "longitude": 127.0638467
  },
  {
    "order": 7,
    "title": "물이 만든 절경",
    "description": "연천을 대표하는 재인폭포를 직접 찾아가 보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_07",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000,
      "caution": "운영·입장정보 사전 확인 필수"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "재인폭포",
    "address": "경기도 연천군 연천읍 부곡리 192",
    "latitude": 38.068896,
    "longitude": 127.133054
  },
  {
    "order": 8,
    "title": "돌기둥의 비밀",
    "description": "Quiz! 재인폭포 주변에서 볼 수 있는 기둥 모양의 지질구조는 무엇일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_08",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "주관식",
      "caution": "암벽 접근 금지"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 9,
    "title": "돌기둥 사이로",
    "description": "재인폭포 주변에서 주상절리의 독특한 무늬가 잘 보이는 장면을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_09",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true,
      "caution": "지질 유산 훼손 금지"
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "재인폭포",
    "address": "경기도 연천군 연천읍 부곡리 192",
    "latitude": 38.068896,
    "longitude": 127.133054
  },
  {
    "order": 10,
    "title": "성 위의 시간",
    "description": "호로고루에서 주변 지형을 바라보며 잠시 머물러보세요.",
    "category": "체류",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_10",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "GPS_STAY",
      "minimumSeconds": 300,
      "allowedDriftM": 100,
      "caution": "성벽 가장자리 안전 유의"
    },
    "targetValue": 300,
    "targetUnit": "SECOND",
    "placeTitle": "호로고루",
    "address": "경기도 연천군 장남면 원당리 1257-1",
    "latitude": 37.9833987,
    "longitude": 126.8627048
  },
  {
    "order": 11,
    "title": "고구려의 시선",
    "description": "호로고루에서 옛 성을 지키던 사람의 시선으로 바라본 풍경을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_11",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "호로고루",
    "address": "경기도 연천군 장남면 원당리 1257-1",
    "latitude": 37.9833987,
    "longitude": 126.8627048
  },
  {
    "order": 12,
    "title": "성 위의 하늘",
    "description": "호로고루와 오늘의 하늘이 함께 보이는 장면을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_12",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "호로고루",
    "address": "경기도 연천군 장남면 원당리 1257-1",
    "latitude": 37.9833987,
    "longitude": 126.8627048
  },
  {
    "order": 13,
    "title": "성을 따라서",
    "description": "임진강변의 또 다른 고구려 성곽인 당포성을 찾아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_13",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000,
      "caution": "유적 보호"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "당포성",
    "address": "경기도 연천군 미산면 동이리 778",
    "latitude": 38.0396,
    "longitude": 126.9976
  },
  {
    "order": 14,
    "title": "고구려 삼총사",
    "description": "호로고루·당포성·은대리성을 모두 찾아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_14",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS 3곳"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 15,
    "title": "신라의 마지막 페이지",
    "description": "연천에 자리한 신라 마지막 왕의 능을 찾아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_15",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "경순왕릉",
    "address": "경기도 연천군 장남면 고랑포리 산18-2",
    "latitude": 37.9912293,
    "longitude": 126.842476
  },
  {
    "order": 16,
    "title": "신라의 마침표",
    "description": "Quiz! 경순왕은 신라의 몇 번째 왕일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_16",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answerHash": "8a03993d15c75b2404a4abc12b61b28637bdb4f49a99fa7304aed1e9c9299994",
      "choices": ["①46대", "②49대", "③54대", "④56대"]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 17,
    "title": "마지막 왕의 길",
    "description": "경순왕릉으로 이어지는 길에서 가장 인상적인 풍경을 기록해보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_17",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 18,
    "title": "강과 성 사이",
    "description": "당포성에서 임진강과 성곽의 흔적이 함께 느껴지는 장면을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_18",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 19,
    "title": "고려 한 컷",
    "description": "숭의전을 방문해 연천에 남아있는 고려의 흔적을 기록해보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_19",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "숭의전",
    "address": "경기도 연천군 미산면 숭의전로 382-27",
    "latitude": 38.024491,
    "longitude": 126.9725807
  },
  {
    "order": 20,
    "title": "처마 끝 연천",
    "description": "숭의전에서 전통 건축의 처마와 하늘이 만나는 모습을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_20",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "숭의전",
    "address": "경기도 연천군 미산면 숭의전로 382-27",
    "latitude": 38.024491,
    "longitude": 126.9725807
  },
  {
    "order": 21,
    "title": "사라진 포구",
    "description": "고랑포구 역사공원에서 옛 포구의 이야기를 만나보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_21",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "고랑포구 역사공원",
    "address": "경기도 연천군 장남면 장남로 270",
    "latitude": 37.9877,
    "longitude": 126.8581
  },
  {
    "order": 22,
    "title": "철길 옆 시간",
    "description": "연천역 옆에 남은 오래된 급수탑을 찾아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_22",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000,
      "caution": "철도 시설 무단 진입 금지"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "연천역 급수탑",
    "address": "경기도 연천군 연천읍 연천로 273-7",
    "latitude": 38.1001,
    "longitude": 127.0738
  },
  {
    "order": 23,
    "title": "급수탑의 역할",
    "description": "Quiz! 연천역 급수탑은 무엇에 물을 공급하던 시설이었을까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_23",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "주관식"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 24,
    "title": "급수탑 키재기",
    "description": "Quiz! 연천역 급수탑의 높이는 얼마나 될까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_24",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answerHash": "c922fcca281c16fec540e9bd2686513c5cd9b60c93880b678f6d0099f02efd17",
      "choices": ["①12m", "②18m", "③23m", "④31m"]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 25,
    "title": "총탄의 흔적",
    "description": "연천역 급수탑에 남아 있는 전쟁의 흔적을 찾아 기록해보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_25",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "연천역 급수탑",
    "address": "경기도 연천군 연천읍 연천로 273-7",
    "latitude": 38.1001,
    "longitude": 127.0738
  },
  {
    "order": 26,
    "title": "철길 옆 풍경",
    "description": "연천역 주변에서 철도와 연천의 풍경이 함께 느껴지는 장면을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_26",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true,
      "caution": "선로 진입 절대 금지"
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천역 일대",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 27,
    "title": "차탄천을 걷다",
    "description": "용암 협곡을 따라 이어지는 길을 걸어보세요.",
    "category": "걷기",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_27",
    "status": "ACTIVE",
    "kind": "WALK_DISTANCE",
    "verificationPolicy": {
      "type": "GPS_DISTANCE",
      "minimumKilometers": 1.0
    },
    "targetValue": 1.0,
    "targetUnit": "KILOMETER",
    "placeTitle": "차탄천 주상절리길",
    "address": "연천읍~전곡읍 일대",
    "latitude": 38.1013,
    "longitude": 127.0718
  },
  {
    "order": 28,
    "title": "지구의 무늬",
    "description": "차탄천에서 가장 독특한 암석 무늬를 찾아 사진으로 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_28",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "차탄천 주상절리길",
    "address": "경기도 연천군 연천읍 차탄리",
    "latitude": 38.1013,
    "longitude": 127.0718
  },
  {
    "order": 29,
    "title": "베개를 찾아서",
    "description": "아우라지에서 베개처럼 둥글게 굳은 용암의 모습을 찾아 기록해보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_29",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "아우라지 베개용암",
    "address": "경기도 연천군 전곡읍 신답리",
    "latitude": 38.0258,
    "longitude": 127.1115
  },
  {
    "order": 30,
    "title": "베개가 된 용암",
    "description": "이름부터 신기한 아우라지 베개용암을 찾아가 보세요",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_30",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "아우라지 베개용암",
    "address": "경기도 연천군 전곡읍 신답리",
    "latitude": 38.0258,
    "longitude": 127.1115
  },
  {
    "order": 31,
    "title": "왜 베개일까?",
    "description": "Quiz! 베개용암이라는 이름이 붙은 이유는 무엇일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_31",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answerHash": "6df08c89e594601a3e9f90cfb23e06b149e4143960b6aff0715fc3fb5b77877b",
      "choices": ["①색이 하얘서", "②베개처럼 둥근 형태", "③부드러워서", "④밤에 형성돼서"]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 32,
    "title": "유네스코도 인정한 좌상바위",
    "description": "좌상바위가 가장 인상적으로 보이는 나만의 구도를 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_32",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "좌상바위",
    "address": "경기도 연천군 전곡읍 신답리",
    "latitude": 38.0383163,
    "longitude": 127.1062501
  },
  {
    "order": 33,
    "title": "바위 하나, 풍경 하나",
    "description": "한탄강 주변의 독특한 좌상바위를 찾아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_33",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "좌상바위",
    "address": "경기도 연천군 전곡읍 신답리",
    "latitude": 38.0383163,
    "longitude": 127.1062501
  },
  {
    "order": 34,
    "title": "임진적벽",
    "description": "임진강을 따라 펼쳐지는 주상절리의 경관을 담아보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_34",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "임진강 주상절리",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 35,
    "title": "열두 번의 물소리",
    "description": "열두개울을 찾아 연천의 물길을 만나보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_35",
    "status": "ACTIVE",
    "kind": "PLACE_VISIT",
    "verificationPolicy": {
      "maximumAccuracyM": 80,
      "maximumAgeMs": 60000
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "열두개울",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 36,
    "title": "강바람 한 모금",
    "description": "임진강 주변에서 잠시 멈춰 강바람과 풍경을 느껴보세요.",
    "category": "휴식",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_36",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "GPS_STAY",
      "minimumSeconds": 180,
      "allowedDriftM": 100
    },
    "targetValue": 180,
    "targetUnit": "SECOND",
    "placeTitle": "임진강 일대",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 37,
    "title": "강물에 비친 하루",
    "description": "물 위에 비친 하늘이나 주변 풍경을 찾아 사진으로 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_37",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 38,
    "title": "맨발로 한 바퀴",
    "description": "망곡산 황토 맨발길 한 바퀴에 도전해보세요.",
    "category": "걷기·체험",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_38",
    "status": "ACTIVE",
    "kind": "WALK_DISTANCE",
    "verificationPolicy": {
      "type": "GPS_DISTANCE",
      "minimumKilometers": 1.0
    },
    "targetValue": 1.0,
    "targetUnit": "KILOMETER",
    "placeTitle": "망곡산 연인공원",
    "address": "경기도 연천군 연천읍 차탄리",
    "latitude": 38.1037,
    "longitude": 127.0773
  },
  {
    "order": 39,
    "title": "숲의 세 가지 색",
    "description": "숲을 걸으며 서로 다른 자연의 색 세 가지를 찾아 사진에 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_39",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "COMPOSITE",
      "requirements": [
        {
          "type": "PHOTO",
          "count": 3
        }
      ]
    },
    "targetValue": 3,
    "targetUnit": "PHOTO",
    "placeTitle": "망곡산 연인공원",
    "address": "경기도 연천군 연천읍 차탄리",
    "latitude": 38.1037,
    "longitude": 127.0773
  },
  {
    "order": 40,
    "title": "숲 사이 한 장",
    "description": "망곡산 연인공원에서 가장 마음에 드는 풍경을 찾아 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_40",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "망곡산 연인공원",
    "address": "경기도 연천군 연천읍 차탄리",
    "latitude": 38.1037,
    "longitude": 127.0773
  },
  {
    "order": 41,
    "title": "처마 아래 배움",
    "description": "전통 건축의 처마와 기와가 돋보이는 장면을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_41",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천향교",
    "address": "경기도 연천군 연천읍 문화로 140",
    "latitude": 38.095808,
    "longitude": 127.0701782
  },
  {
    "order": 42,
    "title": "성헌을 모신 곳",
    "description": "Quiz! 향교에서 성현들의 위패를 모시는 건물은 무엇인가요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_42",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "주관식"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 43,
    "title": "다시 세운 교육",
    "description": "Quiz! 한국전쟁으로 소실된 연천향교가 다시 세워진 연도는 언제일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_43",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answerHash": "57b0cf7d52806d1e119bd725d3c49a35bca32e0866fee957c5b64f95ebb73339",
      "choices": ["①1955년", "②1965년", "③1977년", "④1981년"]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 44,
    "title": "옛 배움터 한 장",
    "description": "향교에서 옛 교육 공간의 분위기가 가장 잘 느껴지는 장면을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_44",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천향교",
    "address": "경기도 연천군 연천읍 문화로 140",
    "latitude": 38.095808,
    "longitude": 127.0701782
  },
  {
    "order": 45,
    "title": "율무를 찾아서",
    "description": "연천에서 율무가 들어간 상품이나 음식을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_45",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 46,
    "title": "두루미를 찾아서",
    "description": "연천에서 두루미 그림, 조형물 또는 안내판을 찾아 사진으로 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_46",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 47,
    "title": "연천의 초록",
    "description": "오늘 연천에서 가장 마음에 드는 초록빛 장면을 찾아보세요.",
    "category": "관찰",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_47",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 48,
    "title": "연천의 포토스팟",
    "description": "나만의 연천 최고 포토스팟을 발견해 사진으로 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_48",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 49,
    "title": "오늘의 연천",
    "description": "오늘의 연천 여행을 가장 잘 표현하는 한 장면과 한 줄을 기록하세요.",
    "category": "사진·기록",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_49",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "COMPOSITE",
      "requirements": [
        {
          "type": "PHOTO",
          "count": 1
        },
        {
          "type": "TEXT",
          "maxLength": 100
        }
      ]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  },
  {
    "order": 50,
    "title": "오늘의 연천색",
    "description": "오늘 연천 여행을 하나의 색으로 표현하고 그 색이 담긴 장면을 찾아보세요.",
    "category": "사진·기록",
    "difficulty": 1,
    "similarityGroup": "YEONCHEON_50",
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "COMPOSITE",
      "requirements": [
        {
          "type": "PHOTO",
          "count": 1
        },
        {
          "type": "TEXT",
          "maxLength": 100
        }
      ]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "연천군 전역",
    "address": null,
    "latitude": null,
    "longitude": null
  }
] as const;

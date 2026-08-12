export const gongjuMissionSeed = [
  {
    "order": 1,
    "title": "백제의 문 앞에서",
    "description": "공산성의 성문 중 하나를 찾아 그 앞에서 공주 여행의 첫 장면을 남겨보세요.",
    "category": "탐색",
    "difficulty": 1,
    "similarityGroup": "GONGJU_GONGSANSEONG",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "공산성",
    "address": "충남 공주시 금성동 53-51"
  },
  {
    "order": 2,
    "title": "금강 한 장",
    "description": "공주에서 바라본 금강의 풍경을 사진 한 장에 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": "GONGJU_GEUMGANG",
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
    "address": null
  },
  {
    "order": 3,
    "title": "왕은 누구일까?",
    "description": "Quiz! 무령왕릉의 주인은 백제의 몇 대 왕일까요?",
    "category": "퀴즈",
    "difficulty": 1,
    "similarityGroup": "GONGJU_ROYAL_TOMB",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answer": "25대",
      "choices": "① 10대 ② 23대 ③ 25대 ④ 6대",
      "explanation": "정답! 무령왕은 백제 25대 왕이에요!"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 4,
    "title": "무덤의 수호자",
    "description": "Quiz! 무령왕릉에서 왕의 곁을 지킨 상상의 동물은 무엇일까요?",
    "category": "퀴즈",
    "difficulty": 2,
    "similarityGroup": "GONGJU_ROYAL_TOMB",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answer": "진묘수",
      "choices": "① 해태 ② 진묘수 ③ 용 ④ 봉황",
      "explanation": "정답! 진묘수는 무령왕릉 널길에서 발견된 상상의 수호 동물이에요."
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 5,
    "title": "고마곰을 찾아서",
    "description": "공주 곳곳에서 공주시 마스코트 '고마곰'을 찾아보세요!",
    "category": "관찰",
    "difficulty": 1,
    "similarityGroup": null,
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "requiredSubject": "공주시 마스코트 고마곰",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": null,
    "address": null
  },
  {
    "order": 6,
    "title": "성곽을 따라",
    "description": "공산성 성곽길을 걸으며 가장 마음에 드는 풍경을 찾아보세요.",
    "category": "탐색",
    "difficulty": 2,
    "similarityGroup": "GONGJU_GONGSANSEONG",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "공산성",
    "address": "충남 공주시 금성동 53-51"
  },
  {
    "order": 7,
    "title": "알밤 한 입",
    "description": "공주의 대표 특산물인 밤을 활용한 음식이나 간식을 맛보세요.",
    "category": "체험",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 8,
    "title": "한옥 사이로",
    "description": "공주한옥마을을 걸으며 가장 마음에 드는 한옥 풍경을 남겨보세요.",
    "category": "탐색",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 9,
    "title": "공주, 쉼, 힐링",
    "description": "공주 어디에서든지 잠시 머물러 편히 쉬다가세요.",
    "category": "휴식",
    "difficulty": 1,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS 체류"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 10,
    "title": "백제의 보물",
    "description": "국립공주박물관에서 가장 기억에 남는 백제 유물 하나를 골라보세요.",
    "category": "관찰",
    "difficulty": 1,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS 방문+텍스트"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "국립공주박물관",
    "address": "충남 공주시 관광단지길 34 국립공주박물관"
  },
  {
    "order": 11,
    "title": "공주 2km",
    "description": "공주 여행 중 누적 2km를 걸어보세요.",
    "category": "걷기",
    "difficulty": 2,
    "similarityGroup": "GONGJU_WALK_DISTANCE",
    "status": "ACTIVE",
    "kind": "WALK_DISTANCE",
    "verificationPolicy": {
      "type": "GPS_DISTANCE",
      "minimumKilometers": 2
    },
    "targetValue": 2,
    "targetUnit": "KILOMETER",
    "placeTitle": null,
    "address": null
  },
  {
    "order": 12,
    "title": "처마 끝 풍경",
    "description": "한옥의 처마나 지붕선이 아름답게 보이는 장면을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 13,
    "title": "1500년 전으로",
    "description": "무령왕릉과 왕릉원에서 시간을 가장 오래 머금고 있는 듯한 장면을 기록해보세요.",
    "category": "탐색·사진",
    "difficulty": 2,
    "similarityGroup": "GONGJU_ROYAL_TOMB",
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
    "placeTitle": "공주 무령왕릉과 왕릉원",
    "address": "충남 공주시 왕릉로 37"
  },
  {
    "order": 14,
    "title": "오늘의 공주색",
    "description": "오늘 공주에서 가장 자주 눈에 들어온 색을 사진으로 남겨보세요.",
    "category": "관찰",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 15,
    "title": "왕릉은 몇 기?",
    "description": "Quiz! 무령왕릉을 포함해 현재 공주 무령왕릉과 왕릉원에 전해지는 고분은 모두 몇 기일까요?",
    "category": "퀴즈",
    "difficulty": 2,
    "similarityGroup": "GONGJU_ROYAL_TOMB",
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answer": "7기",
      "choices": "① 10기 ② 9기 ③ 8기 ④ 7기",
      "explanation": "정답! 지금까지 전해지는 고분은 총 7기입니다."
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 16,
    "title": "금강 바람 한 모금",
    "description": "금강 주변에서 잠시 멈춰 강바람을 느껴보세요.",
    "category": "휴식",
    "difficulty": 1,
    "similarityGroup": "GONGJU_GEUMGANG",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS 체류"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 17,
    "title": "공주는 어디였을까?",
    "description": "Quiz! 공주가 백제의 수도였던 시기의 이름은 무엇일까요?",
    "category": "퀴즈",
    "difficulty": 2,
    "similarityGroup": null,
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answer": "웅진, 웅진시기"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 18,
    "title": "신록을 걷다",
    "description": "마곡사 또는 숲길에서 초록이 가장 아름답게 느껴지는 장면을 찾아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 19,
    "title": "구석기의 하루",
    "description": "석장리 유적 또는 석장리박물관 중 한 곳을 방문해 구석기인의 생활 흔적을 찾아보세요.",
    "category": "탐색",
    "difficulty": 1,
    "similarityGroup": "GONGJU_SEOKJANGNI",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS",
      "allowedPlaces": [
        "석장리 유적",
        "석장리박물관 (한 곳 방문)"
      ]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "석장리 유적 또는 석장리박물관",
    "address": "충남 공주시 금벽로 990"
  },
  {
    "order": 20,
    "title": "돌 하나의 역사",
    "description": "석기나 돌도구 가운데 가장 인상 깊은 것을 한장의 사진으로 남겨주세요.",
    "category": "탐색·사진",
    "difficulty": 2,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 21,
    "title": "산사의 문 앞에서",
    "description": "마곡사·갑사·동학사·신원사 중 한 곳의 입구에서 여행의 한 장면을 기록해보세요.",
    "category": "탐색",
    "difficulty": 1,
    "similarityGroup": "GONGJU_TEMPLE",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진",
      "allowedPlaces": [
        "마곡사",
        "갑사",
        "동학사",
        "신원사"
      ]
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "공주 주요 사찰 중 한 곳",
    "address": null
  },
  {
    "order": 22,
    "title": "계룡의 길",
    "description": "계룡산의 안전한 탐방로를 일정구간 걸어보세요.",
    "category": "걷기",
    "difficulty": 2,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 23,
    "title": "색동 한 장",
    "description": "유구색동수국정원 또는 유구 일대에서 여러 색이 함께 보이는 장면을 담아보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 24,
    "title": "공주 3km",
    "description": "공주 여행 중 누적 3km 이상 걸어보세요.",
    "category": "걷기",
    "difficulty": 3,
    "similarityGroup": "GONGJU_WALK_DISTANCE",
    "status": "ACTIVE",
    "kind": "WALK_DISTANCE",
    "verificationPolicy": {
      "type": "GPS_DISTANCE",
      "minimumKilometers": 3
    },
    "targetValue": 3,
    "targetUnit": "KILOMETER",
    "placeTitle": null,
    "address": null
  },
  {
    "order": 25,
    "title": "천년의 처마",
    "description": "마곡사에서 오래된 건축의 선이 잘 보이는 장면을 찾아보세요.",
    "category": "관찰",
    "difficulty": 2,
    "similarityGroup": "GONGJU_TEMPLE",
    "status": "ACTIVE",
    "kind": "PHOTO",
    "verificationPolicy": {
      "type": "PHOTO",
      "requiredPhotoCount": 1,
      "photoVerificationMode": "AI",
      "requiredSubject": "마곡사의 오래된 처마 또는 건축선",
      "fallbackToAdminReview": true
    },
    "targetValue": 1,
    "targetUnit": "PHOTO",
    "placeTitle": null,
    "address": null
  },
  {
    "order": 26,
    "title": "산 이름의 비밀",
    "description": "Quiz! 계룡산이라는 이름은 무엇을 닮은 산세에서 유래했을까요?",
    "category": "퀴즈",
    "difficulty": 2,
    "similarityGroup": null,
    "status": "ACTIVE",
    "kind": "QUIZ",
    "verificationPolicy": {
      "type": "QUIZ",
      "answer": "용",
      "choices": "① 봉황 ② 닭 ③ 오리 ④ 용",
      "explanation": "정답! 닭의 볏을 쓴 용을 닮았다는 데서 유래되었어요."
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 27,
    "title": "여행 한 페이지",
    "description": "오늘 공주 여행을 대표하는 사진 한 장과 짧은 한 줄을 남겨보세요.",
    "category": "기록",
    "difficulty": 1,
    "similarityGroup": null,
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
    "placeTitle": null,
    "address": null
  },
  {
    "order": 28,
    "title": "공주 포토스팟",
    "description": "내가 고른 공주의 가장 멋진 풍경을 한 장 남겨보세요.",
    "category": "사진",
    "difficulty": 1,
    "similarityGroup": null,
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
    "address": null
  },
  {
    "order": 29,
    "title": "세 개의 시간",
    "description": "공주에서 백제의 흔적, 오래된 도시의 흔적, 오늘날의 공주를 보여주는 장면을 하나씩 찾아보세요.",
    "category": "관찰·수집",
    "difficulty": 3,
    "similarityGroup": null,
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
    "placeTitle": null,
    "address": null
  },
  {
    "order": 30,
    "title": "백제를 기억하다.",
    "description": "공산성이나 왕릉원을 직접 둘러본 뒤, 현장에서 알게 된 백제 이야기를 기록해보세요.",
    "category": "탐방·기록",
    "difficulty": 3,
    "similarityGroup": "GONGJU_GONGSANSEONG",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+메모"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": null,
    "address": null
  },
  {
    "order": 31,
    "title": "공주 탐험가",
    "description": "공주 여행에서 공주 지역 미션 7개를 달성해보세요.",
    "category": "도전",
    "difficulty": 3,
    "similarityGroup": null,
    "status": "ACTIVE",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "AUTO_MISSION_COUNT",
      "requiredCount": 7
    },
    "targetValue": 7,
    "targetUnit": "MISSION",
    "placeTitle": null,
    "address": null
  },
  {
    "order": 32,
    "title": "곰의 전설",
    "description": "고마나루에 얽힌 곰 설화의 흔적을 현장에서 찾아보세요.",
    "category": "탐색",
    "difficulty": 3,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+사진+메모"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "고마나루",
    "address": null
  },
  {
    "order": 33,
    "title": "생태 탐험대",
    "description": "공원을 걸으며 서로 다른 종류의 식물 3가지를 발견해보세요.",
    "category": "관찰",
    "difficulty": 2,
    "similarityGroup": "GONGJU_GEUMHAK_ECO",
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
    "placeTitle": "금학생태공원",
    "address": "충남 공주시 수원지공원길 74"
  },
  {
    "order": 34,
    "title": "초록길 탐험",
    "description": "금학생태공원 안에서 30분 이상 탐방해 보세요.",
    "category": "체류·탐방",
    "difficulty": 3,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS 체류"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "금학생태공원",
    "address": "충남 공주시 수원지공원길 74"
  },
  {
    "order": 35,
    "title": "자세히 보아야",
    "description": "나태주 풀꽃 문학관을 둘러본 뒤 가장 기억에 남은 한 단어를 기록해 보세요.",
    "category": "문학·기록",
    "difficulty": 1,
    "similarityGroup": "GONGJU_NA_TAEJOO",
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS+텍스트"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "나태주 풀꽃문학관",
    "address": "충남 공주시 봉황로 85-12"
  },
  {
    "order": 36,
    "title": "나만의 풀꽃",
    "description": "주변을 천천히 관찰하고 평소 지나쳤을 작은 존재 하나를 골라보세요.",
    "category": "관찰",
    "difficulty": 1,
    "similarityGroup": null,
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
    "placeTitle": null,
    "address": null
  },
  {
    "order": 37,
    "title": "나도 감성 시인",
    "description": "나태주 풀꽃 문학관을 둘러본 뒤 짧은 시 한편을 써 보세요.",
    "category": "문학·기록",
    "difficulty": 2,
    "similarityGroup": "GONGJU_NA_TAEJOO",
    "status": "ACTIVE",
    "kind": "CHECK_IN",
    "verificationPolicy": {
      "type": "TEXT",
      "maxLength": 100
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "나태주 풀꽃문학관",
    "address": "충남 공주시 봉황로 85-12"
  },
  {
    "order": 38,
    "title": "시간을 거슬러",
    "description": "옛공주읍사무소를 찾아 자유롭게 둘러보세요.",
    "category": "탐방",
    "difficulty": 1,
    "similarityGroup": null,
    "status": "NEEDS_REVIEW",
    "kind": "COMPOSITE",
    "verificationPolicy": {
      "type": "MANUAL",
      "intendedVerification": "GPS"
    },
    "targetValue": null,
    "targetUnit": null,
    "placeTitle": "공주 옛 읍사무소",
    "address": "충남 공주시 우체국길 8"
  }
] as const;

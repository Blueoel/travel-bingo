# 개발용 Daily 빙고 시드

## 실행

Docker 인프라를 시작하고 마이그레이션을 적용한 뒤 실행합니다.

```powershell
pnpm infra:up
pnpm db:deploy
pnpm db:seed
pnpm --filter @travel-bingo/api dev
```

시드는 여러 번 실행해도 동일한 개발 데이터를 갱신하며 중복 생성하지 않습니다.

## 시연 데이터

- 사용자 ID: `10000000-0000-4000-8000-000000000001`
- 지역: 경기도 안성시
- 장소 방문: 5개
- 안성 퀴즈: 5개
- 공통 Daily 후보: 32개
- 후보 난이도: 쉬움 21개 · 보통 9개 · 어려움 2개
- 사용자 빙고판: 공통 후보에서 개인별 25개 선별
- Lucky 칸: 사용자별 20% 확률로 별도 적용

현재 인증 기능을 확인하기 위한 개발용 퀴즈 답은 다음과 같습니다.

- 바우덕이
- 경기도
- 안성팜랜드
- 독립운동
- 사찰

장소 좌표와 허용 반경은 `packages/database/prisma/seed.ts`에 정의되어 있습니다.

## API 호출 순서

모든 요청에 아래 임시 사용자 헤더를 사용합니다.

```text
x-user-id: 10000000-0000-4000-8000-000000000001
```

세션 생성과 미션 인증 요청에는 매 요청 작업마다 고유한
`Idempotency-Key` 헤더도 전송해야 합니다.

```text
POST /api/v1/daily-sessions
GET  /api/v1/daily-sessions/today
POST /api/v1/daily-sessions/{sessionId}/cells/{cellId}/complete
POST /api/v1/daily-sessions/{sessionId}/cells/{cellId}/verify
```

퀴즈와 GPS의 서버 판정 정책은 빙고판 조회 응답에 노출되지 않습니다.

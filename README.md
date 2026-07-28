# Travel Bingo

지역 관광 콘텐츠를 5×5 미션형 빙고로 탐험하는 모바일 중심 서비스입니다.

## 저장소 구조

```text
apps/       참가자 웹, 관리자 웹, API, Worker
packages/   도메인 규칙, DB, API 계약, 공통 설정과 UI
```

현재 구현은 핵심 게임 규칙부터 수직 슬라이스 방식으로 진행합니다.

## 개발 명령

```powershell
pnpm install
pnpm env:check
pnpm infra:up
pnpm typecheck
pnpm test
pnpm build
```

로컬 PostgreSQL/PostGIS, Redis, MinIO 설정은
[`docs/개발환경.md`](docs/개발환경.md)를 참고하세요.

참가자 앱의 화면 구성과 디자인 토큰은
[`docs/UI_디자인_기준.md`](docs/UI_디자인_기준.md)를 기준으로 구현합니다.

상세 범위는 `Travel_Bingo_작업분해.md`, 설계 결정은
`Travel_Bingo_아키텍처_설계서.md`를 참고하세요.

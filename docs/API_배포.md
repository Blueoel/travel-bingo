# Travel Bingo API 배포

API는 루트의 `Dockerfile.api`로 배포한다. 컨테이너 시작 시 Prisma 마이그레이션을 먼저 적용하고 NestJS API를 실행한다.

현재 기본 배포 대상은 Render 싱가포르 리전이다. 루트의 `render.yaml` Blueprint가 API와 PostgreSQL을 함께 생성하고 내부 연결 주소를 `DATABASE_URL`에 자동 주입한다.

## 필수 환경변수

```env
NODE_ENV=production
API_PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/travel_bingo?sslmode=require
CORS_ORIGINS=https://travel-bingo-walk.blueo03.chatgpt.site
```

- `DATABASE_URL`: 외부에서 접근 가능한 PostgreSQL 연결 주소
- `CORS_ORIGINS`: 허용할 프런트 주소를 쉼표로 구분한다. 운영 환경에서는 필수다.
- 운영 세션 쿠키는 `HttpOnly`, `Secure`, `SameSite=None`으로 발급되어 별도 API 도메인에서도 PWA가 사용할 수 있다.

## 로컬 이미지 검증

```powershell
docker build -f Dockerfile.api -t travel-bingo-api:local .
docker run --rm -p 4000:4000 `
  -e NODE_ENV=production `
  -e API_PORT=4000 `
  -e DATABASE_URL="<PostgreSQL URL>" `
  -e CORS_ORIGINS="http://localhost:3000" `
  travel-bingo-api:local
```

헬스체크 주소는 `/api/v1/health`다.

## 실제 배포 후

1. 프로젝트를 GitHub 또는 GitLab 원격 저장소에 푸시한다.
2. Render Dashboard에서 **New → Blueprint**를 선택하고 저장소의 `render.yaml`을 연결한다.
3. API의 HTTPS 주소를 확인한다.
4. 참가자 앱의 `NEXT_PUBLIC_API_BASE_URL`을 `https://API주소/api/v1`로 설정한다.
5. 참가자 앱을 다시 빌드하고 Sites에 새 버전을 배포한다.
6. 브라우저에서 게스트 세션 생성, Daily 빙고 생성, 미션 완료를 확인한다.

`render.yaml`은 시연 단계의 무료 플랜을 기본값으로 사용한다. 운영 전환 시 API와 DB 플랜을 유료 인스턴스로 변경하고 백업·모니터링 정책을 추가한다.

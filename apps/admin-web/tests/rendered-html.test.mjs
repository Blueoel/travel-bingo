import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("test", `${Date.now()}`);
  const { default: worker } = await import(url.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders mission editing and Daily composition controls", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Travel Bingo Admin<\/title>/i);
  assert.match(html, /미션 관리/);
  assert.match(html, /Daily 빙고 구성/);
  assert.match(html, /사진 검수/);
  assert.match(html, /사용자 관리/);
  assert.match(html, /새 미션/);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/);

  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const stylesSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /검수 대기 목록/);
  assert.match(pageSource, /<b>Travel Bingo<\/b>/);
  assert.match(pageSource, /decideReview/);
  assert.match(pageSource, /PHOTO_REVIEW_API_URL/);
  assert.match(pageSource, /처리 이력/);
  assert.match(pageSource, /거절 사유 선택/);
  assert.match(pageSource, /제출 일시/);
  assert.match(pageSource, /인증 조건/);
  assert.match(pageSource, /photoZoom/);
  assert.match(pageSource, /가입 사용자/);
  assert.match(
    pageSource,
    /비밀번호는 저장된 해시를 포함해 관리자 화면에 표시하지/,
  );
  assert.match(pageSource, /manageUser/);
  assert.match(pageSource, /탈퇴 처리/);
  assert.match(pageSource, /이메일·비밀번호를 삭제/);
  assert.match(pageSource, /모든 난이도/);
  assert.match(pageSource, /모든 인증 방식/);
  assert.match(pageSource, /유사 그룹 검색/);
  assert.match(pageSource, /Daily 후보 포함 여부/);
  assert.match(pageSource, /사용자별 빙고판을 만들 활성 공통 미션/);
  assert.match(pageSource, /Daily 후보 구성 진단/);
  assert.match(pageSource, /구성 보완이 필요합니다/);
  assert.match(pageSource, /쉬움 · 보통 · 어려움/);
  assert.match(pageSource, /한 판에는 최대 10개/);
  assert.match(pageSource, /텍스트 기록/);
  assert.match(pageSource, /최대 글자 수/);
  assert.match(pageSource, /목표 시간\(분\)/);
  assert.match(pageSource, /durationSeconds/);
  assert.match(pageSource, /const usesEstimatedTime/);
  assert.match(pageSource, /formVerificationType === "GPS_STAY"/);
  assert.match(pageSource, /usesEstimatedTime\s*\? Number\(data\.estimatedMinutesMin\)\s*: null/);
  assert.match(pageSource, /name="quizAnswer"/);
  assert.match(pageSource, /정답은\s*참가자 화면에 공개되지/);
  assert.match(pageSource, /admin\/missions\/photo-reviews/);
  assert.match(pageSource, /화면을 벗어나도 실제 경과 시간/);
  assert.match(pageSource, /지역 서비스 준비 현황/);
  assert.match(pageSource, /행정구역 코드 검색/);
  assert.match(pageSource, /updateRegionStatus/);
  assert.match(pageSource, /region\.canActivate/);
  assert.match(pageSource, /상세 관리/);
  assert.match(pageSource, /공개 준비/);
  assert.match(pageSource, /지역 미션 25칸 구성/);
  assert.match(pageSource, /5×5 배치 미리보기/);
  assert.match(pageSource, /자동 섞기/);
  assert.match(pageSource, /선택한 25칸으로 생성 및 공개/);
  assert.match(pageSource, /missionIds: selectedRegionMissionIds/);
  assert.match(pageSource, /publishRegionBoard/);
  assert.match(pageSource, /publish-board/);
  assert.match(pageSource, /한국관광공사 Open API/);
  assert.match(pageSource, /관광지 추천/);
  assert.match(pageSource, /createMissionFromAttraction/);
  assert.match(pageSource, /이 장소로 미션 만들기/);
  assert.match(pageSource, /const API = "\/api\/backend"/);
  assert.match(pageSource, /공지사항/);
  assert.match(pageSource, /announcementFilter/);
  assert.match(pageSource, /제목 또는 내용 검색/);
  assert.match(pageSource, /예약/);
  assert.match(pageSource, /사용자 신고/);
  assert.match(pageSource, /admin\/users\/reports\/list/);
  assert.match(pageSource, /처리 완료/);
  assert.match(pageSource, /이용 정지 후 완료/);
  assert.match(pageSource, /suspendReportedUser/);
  assert.match(pageSource, /배지 관리/);
  assert.match(pageSource, /배지 획득 실전 테스트/);
  assert.match(pageSource, /admin\/badges\/test\/prepare/);
  assert.match(pageSource, /admin\/badges\/test\/reset/);
  assert.match(pageSource, /임시 테스트 배지 모두 정리/);
  assert.match(stylesSource, /\.badgeTestPanel/);
  assert.match(pageSource, /admin\/badges/);
  assert.match(pageSource, /손그림 이미지 URL/);
  assert.match(pageSource, /COMPLETED_REGIONS/);
  assert.match(pageSource, /displayOrder/);
  assert.match(pageSource, /랭킹 정산/);
  assert.match(pageSource, /admin\/ranking-settlements/);
  assert.match(pageSource, /누락 정산 확인/);
  assert.match(pageSource, /동점자는 같은 순위/);
  assert.match(stylesSource, /\.rankingSettlementAdmin/);

  const proxySource = await readFile(
    new URL("../app/api/backend/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxySource, /BACKEND_API_BASE_URL/);
  assert.match(proxySource, /ADMIN_API_KEY/);
  assert.match(pageSource, /GPS 방문 인증 장소/);
  assert.match(pageSource, /인증 반경\(m\)/);
  assert.match(pageSource, /maximumAccuracyM/);
  assert.match(pageSource, /latitude/);
  assert.match(pageSource, /longitude/);
});

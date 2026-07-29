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
  assert.match(pageSource, /검수 대기 목록/);
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
  assert.match(pageSource, /개인정보를 익명화/);
  assert.match(pageSource, /모든 난이도/);
  assert.match(pageSource, /모든 인증 방식/);
  assert.match(pageSource, /유사 그룹 검색/);
  assert.match(pageSource, /Daily 후보 포함 여부/);
  assert.match(pageSource, /사용자별 빙고판을 만들 활성 공통 미션/);
});

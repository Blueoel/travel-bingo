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
  assert.match(html, /새 미션/);
  assert.doesNotMatch(html, /Your site is taking shape|SkeletonPreview/);

  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /검수 대기 목록/);
  assert.match(pageSource, /decideReview/);
  assert.match(pageSource, /PHOTO_REVIEW_API_URL/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(testDirectory, "..");

async function render(pathname = "/") {
  const serverPath = path.join(projectDirectory, "dist", "server", "index.js");
  const server = await import(pathToFileURL(serverPath).href);

  return server.default.fetch(new Request(`http://localhost${pathname}`));
}

test("renders the Travel Bingo authentication entry", async () => {
  const response = await render();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<title>Travel Bingo \| 산책에서 여행까지<\/title>/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /name="theme-color" content="#173a2c"/);
  assert.match(html, /오늘의 산책을 준비하고 있어요/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /starter/i);
});

test("contains installable PWA and offline support", async () => {
  const manifestSource = await readFile(
    path.join(projectDirectory, "app", "manifest.ts"),
    "utf8",
  );
  const serviceWorkerSource = await readFile(
    path.join(projectDirectory, "public", "sw.js"),
    "utf8",
  );
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(manifestSource, /theme_color:\s*"#173a2c"/);
  assert.match(manifestSource, /background_color:\s*"#fbfaf6"/);
  assert.match(manifestSource, /icons:/);

  assert.match(serviceWorkerSource, /addEventListener\("install"/);
  assert.match(serviceWorkerSource, /addEventListener\("activate"/);
  assert.match(serviceWorkerSource, /addEventListener\("fetch"/);
  assert.match(serviceWorkerSource, /caches\./);

  assert.match(pageSource, /serviceWorker\.register/);
  assert.match(pageSource, /beforeinstallprompt/);
  assert.match(pageSource, /window\.addEventListener\("online"/);
  assert.match(pageSource, /window\.addEventListener\("offline"/);
});

test("uses cookie-backed email authentication without a fixed demo user", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const authSource = await readFile(
    path.join(projectDirectory, "app", "auth-screen.tsx"),
    "utf8",
  );
  const backendProxySource = await readFile(
    path.join(
      projectDirectory,
      "app",
      "api",
      "backend",
      "[...path]",
      "route.ts",
    ),
    "utf8",
  );

  assert.match(pageSource, /\/auth\/me/);
  assert.match(pageSource, /const API_BASE = "\/api\/backend"/);
  assert.match(authSource, /const API_BASE = "\/api\/backend"/);
  assert.match(
    authSource,
    /auth\/\$\{mode === "login" \? "login" : "register"\}/,
  );
  assert.match(authSource, /Apple로 계속하기/);
  assert.match(authSource, /Google로 계속하기/);
  assert.match(pageSource, /credentials:\s*"include"/);
  assert.match(authSource, /credentials:\s*"include"/);
  assert.match(authSource, /mode === "register"/);
  assert.match(authSource, /\/auth\/logout/);
  assert.match(
    authSource,
    /회원가입이 완료됐어요\. 새 계정으로 로그인해주세요\./,
  );
  assert.match(authSource, /await onAuthenticated\(result\.user\)/);
  assert.match(pageSource, /const enterHomeAfterLogin = async/);
  assert.match(pageSource, /setActiveTab\("home"\)/);
  assert.match(pageSource, /await loadDaily\(true\)/);
  assert.match(
    pageSource,
    /<AuthScreen onAuthenticated=\{enterHomeAfterLogin\} \/>/,
  );
  assert.match(backendProxySource, /process\.env\.BACKEND_API_BASE_URL/);
  assert.match(backendProxySource, /request\.headers/);
  assert.match(backendProxySource, /toFirstPartyCookie/);
  assert.match(backendProxySource, /cache-control", "no-store"/);
  assert.doesNotMatch(pageSource, /11111111-1111-4111-8111-111111111111/);
});

test("provides a data-connected home screen after login", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /activeTab === "home"/);
  assert.match(pageSource, /좋은 오후예요/);
  assert.match(pageSource, /Daily Bingo/);
  assert.match(pageSource, /추천 지역/);
  assert.match(pageSource, /진행 중 빙고/);
  assert.match(pageSource, /completeCount\} \/ 25 완료/);
  assert.match(pageSource, /onClick=\{\(\) => setActiveTab\("bingo"\)\}/);
  assert.match(pageSource, /className="app-toast"/);
  assert.match(pageSource, /\/recommendations\/regions/);
  assert.match(pageSource, /recommendNearbyRegions/);
  assert.match(pageSource, /현재 위치와 가까운 활성 지역 순/);
  assert.match(pageSource, /region\.attraction\?\.imageUrl/);
});

test("lists Daily, region, and event bingo entries from one catalog", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /activeTab === "catalog"/);
  assert.match(pageSource, /apiFetch\("\/bingos"\)/);
  assert.match(pageSource, /"DAILY" \| "REGION" \| "EVENT"/);
  assert.match(pageSource, /진행 중인 빙고를 이어가거나/);
  assert.match(pageSource, /setActiveTab\("catalog"\)/);
  assert.match(pageSource, /bingo\.type === "DAILY"/);
  assert.match(pageSource, /openCatalogBingo/);
  assert.match(pageSource, /\/bingos\/sessions\/\$\{bingo\.sessionId\}/);
  assert.match(pageSource, /\/bingos\/\$\{bingo\.templateId\}\/sessions/);
  assert.match(pageSource, /activeTab === "bingo"/);
  assert.match(pageSource, /currentBingo\.title/);
  assert.match(
    pageSource,
    /activeTab === "catalog" \|\| activeTab === "bingo"/,
  );
  assert.match(
    pageSource,
    /onClick=\{\(\) => setActiveTab\("catalog"\)\}/,
  );
});

test("proxies API sessions through the participant origin", async () => {
  let receivedCookie = "";
  const upstream = createServer((request, response) => {
    receivedCookie = request.headers.cookie ?? "";
    response.writeHead(200, {
      "content-type": "application/json",
      "set-cookie":
        "travel_bingo_session=test-token; Path=/; HttpOnly; Secure; SameSite=None",
    });
    response.end(JSON.stringify({ path: request.url }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const address = upstream.address();
  assert.ok(address && typeof address === "object");
  process.env.BACKEND_API_BASE_URL = `http://127.0.0.1:${address.port}/api/v1`;

  try {
    const response = await render("/api/backend/auth/me?source=test");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      path: "/api/v1/auth/me?source=test",
    });
    assert.equal(receivedCookie, "");
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /travel_bingo_session=test-token/,
    );
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    upstream.close();
    await once(upstream, "close");
    delete process.env.BACKEND_API_BASE_URL;
  }
});

test("provides an account dashboard and logout flow", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /activeTab === "my"/);
  assert.match(pageSource, /\/auth\/logout/);
  assert.match(pageSource, /여행 기록/);
  assert.match(pageSource, /획득 배지/);
  assert.match(pageSource, /로그아웃/);

  const logoutSource = pageSource.slice(
    pageSource.indexOf("const logout ="),
    pageSource.indexOf("const celebrate ="),
  );
  assert.ok(
    logoutSource.indexOf('setAuthStatus("unauthenticated")') <
      logoutSource.indexOf('apiFetch("/auth/logout"'),
  );
  assert.doesNotMatch(logoutSource, /await apiFetch/);
});

test("celebrates newly completed bingo lines in API and demo modes", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /const BINGO_LINES = \[/);
  assert.match(pageSource, /completedClientLineKeys\(nextItems\)/);
  assert.match(pageSource, /nextLineKeys\.filter/);
  assert.match(pageSource, /result\.completedLineKeys\.filter/);
  assert.match(pageSource, /<strong>BINGO!<\/strong>/);
});

test("includes the contributed Daily missions and difficulty-based rewards", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /그림자를 따라/);
  assert.match(pageSource, /쉼표/);
  assert.match(pageSource, /같은 색 세 장면/);
  assert.match(pageSource, /신호등 찾기/);
  assert.match(pageSource, /사진 3장/);
  assert.match(pageSource, /GPS 체류/);
  assert.match(pageSource, /item\.title === "Lucky!"/);
});

test("supports the photo verification review and completion flow", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /capture="environment"/);
  assert.match(pageSource, /type:\s*"PHOTO",\s*imageDataUrl/);
  assert.match(pageSource, /fetch\("\/api\/photo-verify"/);
  const verificationRoute = await readFile(
    path.join(projectDirectory, "app", "api", "photo-verify", "route.ts"),
    "utf8",
  );
  assert.match(verificationRoute, /MIN_APPROVAL_CONFIDENCE = 0\.85/);
  assert.match(verificationRoute, /targetVisible/);
  assert.match(
    verificationRoute,
    /제목이나 설명과 무관한 사진은 반드시 REJECTED/,
  );
  assert.match(pageSource, /web-photo-/);
  assert.match(pageSource, /AI가 사진을 확인하고 있어요/);
  assert.match(pageSource, /사진 촬영하기/);
  assert.match(pageSource, /앨범에서 선택/);
  assert.match(pageSource, /주변 사람의 얼굴이나/);
  assert.match(pageSource, /차량번호가 나오지 않도록\s*촬영해주세요/);
  assert.match(pageSource, /className="privacy-warning"/);
  assert.match(pageSource, /대상이 잘 보이도록 촬영하고,\s*<br \/>/);
  assert.doesNotMatch(pageSource, /<span>△<\/span>/);
  assert.doesNotMatch(pageSource, /<b>예상 시간<\/b>/);
  assert.doesNotMatch(pageSource, /<b>주의 사항<\/b>/);
  assert.doesNotMatch(pageSource, /다음 미션 보기/);
  assert.match(pageSource, /빙고판으로 돌아가기/);
});

test("tracks GPS distance and duration missions before server verification", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(pageSource, /navigator\.geolocation\.watchPosition/);
  assert.match(pageSource, /GPS 기록 시작하기/);
  assert.match(pageSource, /GPS_DISTANCE_NOT_REACHED/);
  assert.match(pageSource, /GPS_DURATION_NOT_REACHED/);
  assert.match(pageSource, /type: "ACTIVITY"/);
  assert.match(pageSource, /목표 달성 후 인증 가능/);
});

test("persists photo verdicts and prevents duplicate daily rewards", async () => {
  const hostingConfig = JSON.parse(
    await readFile(
      path.join(projectDirectory, ".openai", "hosting.json"),
      "utf8",
    ),
  );
  const schemaSource = await readFile(
    path.join(projectDirectory, "db", "schema.ts"),
    "utf8",
  );
  const storageSource = await readFile(
    path.join(projectDirectory, "db", "photo-verifications.ts"),
    "utf8",
  );
  const verifyRoute = await readFile(
    path.join(projectDirectory, "app", "api", "photo-verify", "route.ts"),
    "utf8",
  );
  const progressRoute = await readFile(
    path.join(projectDirectory, "app", "api", "photo-progress", "route.ts"),
    "utf8",
  );
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "PHOTOS");
  assert.match(schemaSource, /photoVerificationAttempts/);
  assert.match(schemaSource, /photoMissionAwards/);
  assert.match(schemaSource, /photo_award_guest_mission_date_uq/);
  assert.match(storageSource, /\.onConflictDoNothing\(\)/);
  assert.match(storageSource, /dailyDateInSeoul/);
  assert.match(verifyRoute, /recordPhotoVerdict/);
  assert.match(verifyRoute, /awardGranted/);
  assert.match(progressRoute, /getPhotoProgress/);
  assert.match(pageSource, /fetch\("\/api\/photo-progress"\)/);
  assert.match(pageSource, /verdict\.awardGranted !== false/);
});

test("provides an owner-only photo review queue", async () => {
  const schemaSource = await readFile(
    path.join(projectDirectory, "db", "schema.ts"),
    "utf8",
  );
  const reviewApi = await readFile(
    path.join(
      projectDirectory,
      "app",
      "api",
      "admin",
      "photo-reviews",
      "route.ts",
    ),
    "utf8",
  );
  const storageSource = await readFile(
    path.join(projectDirectory, "db", "photo-storage.ts"),
    "utf8",
  );

  assert.match(reviewApi, /oai-authenticated-user-email/);
  assert.match(reviewApi, /status.*history/);
  assert.match(schemaSource, /reviewReason/);
  assert.match(storageSource, /env\.PHOTOS/);
  assert.match(storageSource, /bucket\.put/);
});

test("shows GPS place and permission guidance for visit missions", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );
  assert.match(pageSource, /인증 반경/);
  assert.match(pageSource, /위치 권한/);
  assert.match(pageSource, /selected\.place/);
  assert.match(pageSource, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(pageSource, /GPS 사전 점검/);
  assert.match(pageSource, /현재 위치 점검/);
  assert.match(pageSource, /오차 약/);
  assert.match(stylesSource, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(stylesSource, /overflow-wrap: anywhere/);
  assert.match(stylesSource, /-webkit-line-clamp: 3/);
  assert.match(pageSource, /title=\{item\.title\}/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(testDirectory, "..");

test("ships an interactive nationwide administrative SVG map", async () => {
  const svg = await readFile(
    path.join(projectDirectory, "public", "maps", "korea-sigungu.svg"),
    "utf8",
  );
  const metadata = JSON.parse(
    await readFile(
      path.join(
        projectDirectory,
        "public",
        "maps",
        "korea-sigungu.meta.json",
      ),
      "utf8",
    ),
  );

  assert.match(svg, /viewBox="0 0 900 1260"/);
  assert.match(svg, /id="region-31220"/);
  assert.match(svg, /data-name="안성시"/);
  assert.match(svg, /data-region-type="COUNTY"/);
  assert.equal(
    (svg.match(/class="region administrative-region"/g) ?? []).length,
    162,
  );
  assert.equal((svg.match(/class="region-label"/g) ?? []).length, 162);
  assert.match(svg, /id="korea-region-labels"/);
  assert.match(svg, />안성<\/text>/);
  assert.match(svg, /data-name="양평군"/);
  assert.match(svg, />양평<\/text>/);
  assert.match(svg, /data-name="서울특별시"/);
  assert.match(svg, /data-name="수원시"/);
  assert.doesNotMatch(svg, /data-name="수원시 영통구"/);
  assert.doesNotMatch(svg, />영통<\/text>/);
  assert.equal(metadata.regionCount, 162);
  assert.equal(
    metadata.metropolitanCount + metadata.cityCount + metadata.countyCount,
    162,
  );
  assert.equal(metadata.metropolitanCount, 8);
  assert.equal(metadata.cityCount, 77);
  assert.equal(metadata.countyCount, 77);
  assert.equal(metadata.boundarySimplificationToleranceM, 900);
  assert.equal(metadata.dokdo.preservedAsMarker, true);
  assert.deepEqual(metadata.visualInsets.jeju, [250, 1120, 230, 90]);
  assert.deepEqual(metadata.visualInsets.ulleungdo, [830, 420, 32, 32]);
  assert.deepEqual(metadata.visualInsets.dokdo, [885, 455]);
  assert.equal(metadata.minimumCityIslandAreaM2, 10_000_000);
  assert.match(svg, /id="korea-land-background"/);
  assert.match(svg, /id="dokdo"/);
  assert.deepEqual(
    metadata.regions.find((region) => region.id === "region-31220"),
    {
      code: "31220",
      name: "안성시",
      province: "경기도",
      regionType: "CITY",
      id: "region-31220",
      bounds: {
        minX: 445.5,
        minY: 447.27,
        maxX: 515.92,
        maxY: 502.8,
      },
      center: [480.71, 475.04],
    },
  );
});

test("shows published announcements and records important notice reads", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  assert.match(pageSource, /apiFetch\("\/announcements"\)/);
  assert.match(pageSource, /\/announcements\/\$\{item\.id\}\/read/);
  assert.match(pageSource, /unreadImportant/);
  assert.match(pageSource, /공지사항/);
  assert.match(pageSource, /Math\.min\(99, announcements\.filter/);
});

test("shows ranking reward notifications and reward history", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  const styles = await readFile(path.join(projectDirectory, "app", "globals.css"), "utf8");
  assert.match(pageSource, /apiFetch\("\/rankings\/rewards"\)/);
  assert.match(pageSource, /rankings\/rewards\/\$\{item\.id\}\/read/);
  assert.match(pageSource, /랭킹 보상 이력/);
  assert.match(pageSource, /전체 랭킹 상위 3위/);
  assert.match(pageSource, /rankingRewards\.filter\(\(item\) => !item\.isRead\)/);
  assert.match(styles, /\.ranking-reward-list/);
});

test("manages friends and opens the real friend ranking", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  assert.match(pageSource, /apiFetch\("\/friends"\)/);
  assert.match(pageSource, /friends\/search/);
  assert.match(pageSource, /친구 관리/);
  assert.doesNotMatch(pageSource, /친구 추가 기능이 준비되면/);
});

test("connects the nationwide map to the exploration tab", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const styles = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /activeTab === "exploration"/);
  assert.match(pageSource, /fetch\("\/maps\/korea-sigungu\.svg"\)/);
  assert.match(pageSource, /대한민국 광역·시·군 탐험 지도/);
  assert.match(pageSource, /path\[data-code\]/);
  assert.match(pageSource, /selectedMapRegion\.code/);
  assert.match(pageSource, /updateMapScale/);
  assert.match(pageSource, /handleMapPointerMove/);
  assert.match(pageSource, /className="exploration-header-side"/);
  assert.match(pageSource, /탐험 완료 지역/);
  assert.doesNotMatch(pageSource, /exploration-header-marker/);
  assert.match(pageSource, /scale: 1\.06/);
  assert.match(styles, /\.exploration-map-viewport/);
  assert.match(styles, /height:\s*min\(66vh,\s*620px\)/);
  assert.match(styles, /path\[data-code="31220"\]/);
  assert.match(styles, /stroke-width:\s*0\.56\s*!important/);
  assert.match(styles, /fill:\s*#69a66f\s*!important/);
  assert.match(styles, /\.exploration-map \.region-label/);
  assert.match(styles, /\.exploration-map path\.is-selected/);
});

test("unlocks and fills regions with persistent representative photos", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const memoryRoute = await readFile(
    path.join(
      projectDirectory,
      "app",
      "api",
      "exploration",
      "regions",
      "[code]",
      "route.ts",
    ),
    "utf8",
  );
  const photoRoute = await readFile(
    path.join(
      projectDirectory,
      "app",
      "api",
      "exploration",
      "regions",
      "[code]",
      "photo",
      "route.ts",
    ),
    "utf8",
  );

  assert.doesNotMatch(pageSource, /시연용 3 Bingo 달성/);
  assert.match(pageSource, /explorationRecords/);
  assert.match(pageSource, /selectedRegionRecord/);
  assert.doesNotMatch(pageSource, /획득한 테두리/);
  assert.match(pageSource, /addRepresentativePhotoPatterns/);
  assert.match(pageSource, /memory-photo-/);
  assert.match(pageSource, /has-memory-photo/);
  assert.match(
    pageSource,
    /fill:url\(#memory-photo-/,
  );
  assert.match(memoryRoute, /lineCount < 3/);
  assert.match(memoryRoute, /exploration_region_memories/);
  assert.doesNotMatch(memoryRoute, /demoAnseongPhoto/);
  assert.match(memoryRoute, /getEligibleMemoryPhoto/);
  assert.match(pageSource, /인증 사진에서 선택/);
  assert.match(pageSource, /memory-photo-picker/);
  assert.match(photoRoute, /getReviewPhoto/);
});

test("loads only started region progress for the exploration map", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const listRoute = await readFile(
    path.join(
      projectDirectory,
      "app",
      "api",
      "exploration",
      "regions",
      "route.ts",
    ),
    "utf8",
  );
  assert.match(pageSource, /fetch\("\/api\/exploration\/regions"/);
  assert.match(pageSource, /item\.type === "REGION"/);
  assert.match(pageSource, /Boolean\(item\.sessionId\)/);
  assert.match(pageSource, /region\.regionCode/);
  assert.match(pageSource, /travelRecordsByYear/);
  assert.match(listRoute, /ORDER BY selected_at DESC/);
});

test("opens a functional participant menu and rejects stale GPS tracking", async () => {
  const [pageSource, styles] = await Promise.all([
    readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8"),
    readFile(path.join(projectDirectory, "app", "globals.css"), "utf8"),
  ]);
  assert.match(pageSource, /aria-controls="participant-side-menu"/);
  assert.match(pageSource, /Travel Bingo 이용 방법/);
  assert.match(pageSource, /GPS·사진 인증 안내/);
  assert.match(pageSource, /관광정보 활용 안내/);
  assert.match(pageSource, /trackingAge > MAX_TRACKING_RESUME_AGE_MS/);
  assert.match(styles, /\.side-menu-panel/);
});

test("keeps home as the initial tab while placing it at the center of navigation", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const cssSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );
  assert.match(pageSource, /useState<[\s\S]*?>\("home"\)/);

  const navigation = pageSource.match(/<nav>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const labels = [...navigation.matchAll(/aria-hidden="true" \/>(탐험|빙고|홈|랭킹|마이페이지)/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(labels, ["탐험", "빙고", "홈", "랭킹", "마이페이지"]);
  assert.match(pageSource, /src="\/icons\/navigation\/home\.svg"/);
  assert.match(cssSource, /\.region-ongoing small\s*{[^}]*color:\s*#ed7258/s);
  assert.match(cssSource, /\.region-ongoing > span > i b\s*{[^}]*background:\s*#ed7258/s);
});

test("shows the brand symbol on authentication and keeps the home hierarchy compact", async () => {
  const authSource = await readFile(
    path.join(projectDirectory, "app", "auth-screen.tsx"),
    "utf8",
  );
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(authSource, /className={`auth-brand-showcase \$\{mode\}`}/);
  assert.match(authSource, /mode === "login" \? "\/brand\/logo-text\.svg" : "\/brand\/logo-notext\.svg"/);
  assert.doesNotMatch(authSource, /산책에서 여행까지/);
  assert.doesNotMatch(authSource, /doodle-ground/);
  assert.match(pageSource, /<b>Travel Bingo<\/b>/);
  assert.doesNotMatch(pageSource, /className="home-brand-logo"/);
  assert.ok(pageSource.indexOf("추천 지역") < pageSource.indexOf("진행 중인 빙고"));
});

test("uses the cream brand background across participant screens", async () => {
  const cssSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(cssSource, /--app-bg:\s*#f7f4ed/);
  assert.match(cssSource, /--deep-green:\s*#2d4a3a/);
  assert.match(cssSource, /--leaf-green:\s*#7fa26b/);
  assert.match(cssSource, /--yellow:\s*#f2c94c/);
  assert.match(cssSource, /--coral:\s*#f28b82/);
  assert.match(cssSource, /--sky-blue:\s*#7db7d8/);
  assert.match(cssSource, /--warm-brown:\s*#a67c52/);
  for (const selector of [
    "body",
    ".app-shell",
    ".region-directory-screen",
    ".ranking-screen",
  ]) {
    const escaped = selector.replace(".", "\\.");
    assert.match(cssSource, new RegExp(`${escaped}\\s*\\{[\\s\\S]*?background:[^;}]*var\\(--app-bg\\)`, "s"));
  }
});

test("shows a simple shareable bingo board with completed photo cells", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  const cssSource = await readFile(path.join(projectDirectory, "app", "globals.css"), "utf8");

  assert.match(pageSource, /className="bingo-notebook"/);
  assert.match(pageSource, /className="bingo-share-card"/);
  assert.match(pageSource, /navigator\.share/);
  assert.match(pageSource, /className="board-photo"/);
  assert.match(pageSource, /saveBingoPhoto/);
  assert.match(cssSource, /\.auth-brand-showcase \{[\s\S]*?width:\s*244px/);
});

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
  assert.match(pageSource, /더보기 ›/);
  assert.doesNotMatch(pageSource, /내 주변 ⌖/);
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
  assert.match(pageSource, /"ALL" \| "COMMON" \| "REGION" \| "FRIEND"/);
  assert.match(pageSource, /도전 중인 지역/);
  assert.match(pageSource, /regionCode", rankingRegionCode/);
  assert.match(pageSource, /친구 관리 · 요청 확인/);
  assert.match(pageSource, /result\.verificationStatus === "NEEDS_REVIEW"/);
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

test("provides an account dashboard and confirmed logout flow", async () => {
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
  assert.match(logoutSource, /await apiFetch\("\/auth\/logout"/);
  assert.ok(
    logoutSource.indexOf('await apiFetch("/auth/logout"') <
      logoutSource.indexOf("clearAuthenticatedState()"),
  );
  assert.match(logoutSource, /response\.status !== 401/);
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
  assert.match(pageSource, /travel-bingo-active-gps/);
  assert.match(pageSource, /visibilitychange/);
  assert.match(pageSource, /active-gps-banner/);
  assert.match(pageSource, /reopenTrackingMission/);
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

test("shows completed exploration memories and opens their detail sheet", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /탐험 완료 지역/);
  assert.match(pageSource, /추억 보기/);
  assert.match(pageSource, /에서 남긴 한 장/);
  assert.match(pageSource, /대표 사진 바꾸기/);
  assert.match(stylesSource, /\.memory-detail-sheet/);
});

test("connects completed exploration memories to the travel note", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /"main" \| "travel-note"/);
  assert.match(pageSource, /빙고로 완성한 여행 이야기/);
  assert.match(pageSource, /3 Bingo 탐험 완료/);
  assert.match(pageSource, /첫 여행 기록을 기다리고 있어요/);
  assert.match(stylesSource, /\.travel-note-card/);
});

test("shows approved regional mission photos inside the travel memory", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /여행 중 남긴 사진/);
  assert.match(pageSource, /memoryPhotos\.map/);
  assert.match(pageSource, /대표 사진으로 지정/);
  assert.match(pageSource, /사진을 누르면 지도 대표 사진으로 바뀌어요/);
  assert.match(stylesSource, /\.memory-gallery-grid/);
});

test("starts available recommended region bingos after confirmation", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const recommendationService = await readFile(
    path.join(
      projectDirectory,
      "..",
      "api",
      "src",
      "recommendations",
      "region-recommendation.service.ts",
    ),
    "utf8",
  ).catch(() => "");

  assert.match(pageSource, /availableRegionRecommendations/);
  assert.match(pageSource, /!item\.sessionId/);
  assert.match(pageSource, /도전할까요/);
  assert.match(pageSource, /void openCatalogBingo\(challenge\.bingo\)/);
  assert.doesNotMatch(pageSource, /지역 빙고는 곧 공개할 예정이에요/);
  if (recommendationService) {
    assert.match(recommendationService, /templates:/);
    assert.match(recommendationService, /status: "PUBLISHED"/);
  }
});

test("searches the full region directory and separates ready regions", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );
  assert.match(pageSource, /도전할 지역 찾기/);
  assert.match(pageSource, /지역명을 입력해보세요/);
  assert.match(pageSource, /korea-sigungu\.meta\.json/);
  assert.match(pageSource, /setRegionSearch\(event\.target\.value\)/);
  assert.match(pageSource, /const HANGUL_INITIALS/);
  assert.match(pageSource, /function hangulInitials/);
  assert.match(pageSource, /function matchesHangulPattern/);
  assert.match(pageSource, /matchesRegionSearch\(searchTarget, normalizedRegionSearch\)/);
  assert.match(pageSource, /matchesHangulPattern\(compactValue, compactQuery\)/);
  assert.match(stylesSource, /::-webkit-search-cancel-button/);
  assert.match(stylesSource, /::-ms-clear/);
  assert.match(pageSource, /item\.state === "IN_PROGRESS"/);
  assert.match(pageSource, /지금 지역 빙고에 도전할 수 있어요/);
  assert.match(pageSource, /지역 빙고 준비 중/);
  assert.match(pageSource, /disabled=\{!bingo\}/);
  assert.match(pageSource, /void openCatalogBingo\(challenge\.bingo\)/);
});

test("exposes friend management and received request badges from My", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /친구 관리/);
  assert.match(pageSource, /item\.direction === "RECEIVED"/);
  assert.match(pageSource, /친구 \{friends\.filter/);
  assert.match(pageSource, /보낸 요청/);
  assert.match(pageSource, /요청 취소/);
  assert.match(pageSource, /친구 삭제/);
  assert.match(pageSource, /method: "DELETE"/);
  assert.match(pageSource, /FRIEND PROFILE/);
  assert.match(pageSource, /활동 프로필 보기/);
  assert.match(pageSource, /친구 랭킹 보러가기/);
  assert.match(pageSource, /setRankingScope\("FRIEND"\)/);
  assert.match(pageSource, /친구 요청을 보냈어요/);
  assert.match(pageSource, /친구가 되었어요/);
  assert.match(pageSource, /friends\/\$\{item\.id\}\/read/);
  assert.match(pageSource, /사용자 신고/);
  assert.match(pageSource, /서로 친구 목록과 랭킹에서 제외/);
  assert.match(pageSource, /friends\/\$\{profile\.id\}\/block/);
  assert.match(pageSource, /차단한 사용자/);
  assert.match(pageSource, /차단 해제/);
  assert.match(pageSource, /friends\/blocks\/\$\{block\.id\}/);
  assert.match(stylesSource, /\.friend-request-badge/);
  assert.match(stylesSource, /\.friend-notification/);
  assert.match(stylesSource, /\.friend-empty/);
  assert.match(stylesSource, /\.friend-profile-stats/);
  assert.match(stylesSource, /\.report-sheet/);
  assert.match(stylesSource, /\.blocked-user-list/);
});

test("shows account-backed achievement badges from My", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );
  const stylesSource = await readFile(
    path.join(projectDirectory, "app", "globals.css"),
    "utf8",
  );

  assert.match(pageSource, /openBadges/);
  assert.match(pageSource, /friends\/badges/);
  assert.match(pageSource, /걸으며 모은 작은 성취/);
  assert.match(pageSource, /badge\.progress/);
  assert.match(stylesSource, /\.badge-grid/);
  assert.match(stylesSource, /\.badge-summary/);
});

test("queues newly earned badge celebrations after bingo and records notifications", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  const stylesSource = await readFile(path.join(projectDirectory, "app", "globals.css"), "utf8");
  assert.match(pageSource, /friends\/badges\/sync/);
  assert.match(pageSource, /friends\/badge-notifications/);
  assert.match(pageSource, /if \(bingoFlash \|\| badgeCelebration \|\| !badgeQueue\.length\) return/);
  assert.match(pageSource, /새 배지를 획득했어요!/);
  assert.match(pageSource, /획득 배지 보기/);
  assert.match(pageSource, /aria-label="배지 축하 창 닫기"/);
  assert.match(stylesSource, /\.badge-celebration-backdrop/);
});

test("manages the participant profile and shows cumulative account stats", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  const stylesSource = await readFile(path.join(projectDirectory, "app", "globals.css"), "utf8");
  assert.match(pageSource, /auth\/profile/);
  assert.match(pageSource, /auth\/password/);
  assert.match(pageSource, /auth\/account/);
  assert.match(pageSource, /현재 비밀번호를 입력해주세요/);
  assert.match(pageSource, /새 비밀번호 확인/);
  assert.match(pageSource, /withdrawPassword/);
  assert.match(pageSource, /로그아웃 중/);
  assert.match(pageSource, /badgeSummary\?\.totals\.completedMissions/);
  assert.match(pageSource, /badgeSummary\?\.totals\.completedBingos/);
  assert.match(stylesSource, /\.account-settings-card/);
  assert.match(stylesSource, /\.withdraw-card/);
});

test("supports secure QR mission scanning with a manual code fallback", async () => {
  const pageSource = await readFile(path.join(projectDirectory, "app", "page.tsx"), "utf8");
  const stylesSource = await readFile(path.join(projectDirectory, "app", "globals.css"), "utf8");
  assert.match(pageSource, /BrowserQRCodeReader/);
  assert.match(pageSource, /type: "QR", token/);
  assert.match(pageSource, /카메라로 QR 스캔/);
  assert.match(pageSource, /코드로 인증하기/);
  assert.match(pageSource, /QR_INVALID/);
  assert.match(pageSource, /QR_EXPIRED/);
  assert.match(stylesSource, /\.qr-verification-panel/);
  assert.match(stylesSource, /\.qr-camera/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("renders the Travel Bingo daily walk screen", async () => {
  const response = await render();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(html, /<html lang="ko"/);
  assert.match(html, /<title>Travel Bingo \| 오늘의 산책<\/title>/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /name="theme-color" content="#173a2c"/);
  assert.match(html, /오늘의 산책 빙고/);
  assert.match(html, /DAILY WALK/);
  assert.match(html, /오늘의 빙고를 준비하고 있어요/);
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

test("uses cookie-backed guest authentication without a fixed demo user", async () => {
  const pageSource = await readFile(
    path.join(projectDirectory, "app", "page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /\/auth\/me/);
  assert.match(pageSource, /\/auth\/guest/);
  assert.match(pageSource, /credentials:\s*"include"/);
  assert.doesNotMatch(pageSource, /11111111-1111-4111-8111-111111111111/);
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
});

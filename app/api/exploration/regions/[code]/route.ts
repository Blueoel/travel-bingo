import { NextResponse } from "next/server";

import {
  resolveGuest,
  withGuestCookie,
} from "../../../../../db/photo-verifications";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const SUPPORTED_REGION_CODES = new Set(["31220"]);

async function bindings() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB || !env.PHOTOS) {
    throw new Error("Exploration storage bindings are unavailable.");
  }
  return { database: env.DB, bucket: env.PHOTOS };
}

async function ensureTable(database: D1Database) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS exploration_region_memories (
        guest_id TEXT NOT NULL,
        region_code TEXT NOT NULL,
        photo_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        line_count INTEGER NOT NULL DEFAULT 3,
        selected_at INTEGER NOT NULL,
        PRIMARY KEY (guest_id, region_code)
      )`,
    )
    .run();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!SUPPORTED_REGION_CODES.has(code)) {
    return NextResponse.json({ error: "Unsupported region" }, { status: 404 });
  }
  const guest = resolveGuest(request);
  try {
    const { database } = await bindings();
    await ensureTable(database);
    const memory = await database
      .prepare(
        `SELECT line_count AS lineCount, selected_at AS selectedAt
         FROM exploration_region_memories
         WHERE guest_id = ? AND region_code = ?`,
      )
      .bind(guest.guestId, code)
      .first<{ lineCount: number; selectedAt: number }>();
    return withGuestCookie(
      NextResponse.json({
        regionCode: code,
        lineCount: memory?.lineCount ?? 0,
        unlocked: (memory?.lineCount ?? 0) >= 3,
        photoUrl: memory
          ? `/api/exploration/regions/${code}/photo?v=${memory.selectedAt}`
          : null,
        selectedAt: memory?.selectedAt
          ? new Date(memory.selectedAt).toISOString()
          : null,
      }),
      guest,
    );
  } catch {
    return withGuestCookie(
      NextResponse.json({
        regionCode: code,
        lineCount: 0,
        unlocked: false,
        photoUrl: null,
        selectedAt: null,
      }),
      guest,
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!SUPPORTED_REGION_CODES.has(code)) {
    return NextResponse.json({ error: "Unsupported region" }, { status: 404 });
  }

  const guest = resolveGuest(request);
  const contentType = request.headers.get("content-type") ?? "";
  let bytes: Uint8Array;
  let mimeType: string;
  let lineCount: number;

  if (contentType.includes("application/json")) {
    const input = (await request.json()) as {
      demo?: boolean;
      lineCount?: number;
    };
    if (!input.demo) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    lineCount = Number(input.lineCount ?? 0);
    mimeType = "image/svg+xml";
    bytes = new TextEncoder().encode(demoAnseongPhoto());
  } else {
    const form = await request.formData();
    const photo = form.get("photo");
    lineCount = Number(form.get("lineCount") ?? 0);
    if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 },
      );
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { error: "Photo must be 8 MB or smaller" },
        { status: 413 },
      );
    }
    mimeType = photo.type;
    bytes = new Uint8Array(await photo.arrayBuffer());
  }

  if (lineCount < 3) {
    return NextResponse.json(
      { error: "Three completed bingo lines are required" },
      { status: 403 },
    );
  }

  try {
    const { database, bucket } = await bindings();
    await ensureTable(database);
    const photoKey = `exploration/${guest.guestId}/${code}/${crypto.randomUUID()}`;
    await bucket.put(photoKey, bytes, {
      httpMetadata: { contentType: mimeType },
    });
    const previous = await database
      .prepare(
        `SELECT photo_key AS photoKey
         FROM exploration_region_memories
         WHERE guest_id = ? AND region_code = ?`,
      )
      .bind(guest.guestId, code)
      .first<{ photoKey: string }>();
    const selectedAt = Date.now();
    await database
      .prepare(
        `INSERT INTO exploration_region_memories
          (guest_id, region_code, photo_key, mime_type, line_count, selected_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (guest_id, region_code) DO UPDATE SET
          photo_key = excluded.photo_key,
          mime_type = excluded.mime_type,
          line_count = excluded.line_count,
          selected_at = excluded.selected_at`,
      )
      .bind(
        guest.guestId,
        code,
        photoKey,
        mimeType,
        Math.floor(lineCount),
        selectedAt,
      )
      .run();
    if (previous?.photoKey && previous.photoKey !== photoKey) {
      await bucket.delete(previous.photoKey);
    }
    return withGuestCookie(
      NextResponse.json({
        regionCode: code,
        lineCount: Math.floor(lineCount),
        unlocked: true,
        photoUrl: `/api/exploration/regions/${code}/photo?v=${selectedAt}`,
        selectedAt: new Date(selectedAt).toISOString(),
      }),
      guest,
    );
  } catch {
    return withGuestCookie(
      NextResponse.json(
        { error: "Representative photo could not be saved" },
        { status: 500 },
      ),
      guest,
    );
  }
}

function demoAnseongPhoto() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#8cc9df"/>
      <stop offset="1" stop-color="#f8df9c"/>
    </linearGradient>
  </defs>
  <rect width="800" height="520" fill="url(#sky)"/>
  <circle cx="650" cy="105" r="50" fill="#ffd45f"/>
  <path d="M0 335 Q140 230 290 330 T570 300 T800 320 V520 H0Z" fill="#7ca56a"/>
  <path d="M0 390 Q170 300 350 390 T800 365 V520 H0Z" fill="#4f7d50"/>
  <path d="M290 360 L400 260 L510 360 V455 H290Z" fill="#f7f0dc" stroke="#4a5d3d" stroke-width="10"/>
  <path d="M270 365 L400 235 L530 365" fill="none" stroke="#573f2e" stroke-width="24" stroke-linecap="round"/>
  <rect x="382" y="362" width="45" height="93" rx="4" fill="#7b5035"/>
  <path d="M0 478 Q210 425 390 480 T800 455 V520 H0Z" fill="#d9b36c"/>
  <text x="35" y="70" fill="#fffdf3" stroke="#385841" stroke-width="3" paint-order="stroke" font-family="sans-serif" font-size="40" font-weight="800">안성의 오늘</text>
</svg>`;
}

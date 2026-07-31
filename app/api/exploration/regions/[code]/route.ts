import { NextResponse } from "next/server";

import {
  getEligibleMemoryPhoto,
  resolveGuest,
  withGuestCookie,
} from "../../../../../db/photo-verifications";
import { getReviewPhoto } from "../../../../../db/photo-storage";

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

  if (contentType.includes("application/json")) {
    const input = (await request.json()) as {
      photoId?: string;
    };
    if (!input.photoId) {
      return NextResponse.json({ error: "Photo is required" }, { status: 400 });
    }
    const selectedPhoto = await getEligibleMemoryPhoto(
      guest.guestId,
      input.photoId,
    );
    const storedPhoto = selectedPhoto?.photoKey
      ? await getReviewPhoto(selectedPhoto.photoKey)
      : null;
    if (!storedPhoto) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    mimeType = storedPhoto.httpMetadata?.contentType ?? "image/jpeg";
    bytes = new Uint8Array(await storedPhoto.arrayBuffer());
  } else {
    const form = await request.formData();
    const photo = form.get("photo");
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

  const lineCount = await actualAnseongLineCount(request);
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

async function actualAnseongLineCount(request: Request): Promise<number> {
  try {
    const cookie = request.headers.get("cookie") ?? "";
    const catalogResponse = await fetch(new URL("/api/backend/bingos", request.url), {
      headers: { cookie },
      signal: AbortSignal.timeout(30_000),
    });
    if (!catalogResponse.ok) return 0;
    const catalog = (await catalogResponse.json()) as {
      items?: Array<{
        type?: string;
        regionName?: string | null;
        sessionId?: string | null;
      }>;
    };
    const anseong = catalog.items?.find(
      (item) =>
        item.type === "REGION" &&
        item.regionName?.includes("안성") &&
        item.sessionId,
    );
    if (!anseong?.sessionId) return 0;
    const boardResponse = await fetch(
      new URL(`/api/backend/bingos/sessions/${anseong.sessionId}`, request.url),
      { headers: { cookie }, signal: AbortSignal.timeout(30_000) },
    );
    if (!boardResponse.ok) return 0;
    const board = (await boardResponse.json()) as {
      completedLineKeys?: string[];
    };
    return board.completedLineKeys?.length ?? 0;
  } catch {
    return 0;
  }
}

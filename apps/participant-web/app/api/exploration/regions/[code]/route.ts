import { NextResponse } from "next/server";

import {
  getEligibleMemoryPhoto,
  resolveGuest,
} from "../../../../../db/photo-verifications";
import { getReviewPhoto } from "../../../../../db/photo-storage";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const REGION_CODE_PATTERN = /^\d{2,10}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!REGION_CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Unsupported region" }, { status: 404 });
  }
  try {
    const response = await fetch(new URL(`/api/backend/travel-memories/${code}`, request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({
        regionCode: code,
        lineCount: 0,
        unlocked: false,
        photoUrl: null,
        selectedAt: null,
      }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!REGION_CODE_PATTERN.test(code)) {
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

  const lineCount = await actualRegionLineCount(request, code);
  if (lineCount < 3) {
    return NextResponse.json(
      { error: "Three completed bingo lines are required" },
      { status: 403 },
    );
  }

  try {
    const imageDataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
    const response = await fetch(new URL(`/api/backend/travel-memories/${code}`, request.url), {
      method: "PUT",
      headers: { cookie: request.headers.get("cookie") ?? "", "content-type": "application/json" },
      body: JSON.stringify({ imageDataUrl, lineCount: Math.floor(lineCount) }),
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
        { error: "Representative photo could not be saved" },
        { status: 500 },
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

async function actualRegionLineCount(
  request: Request,
  regionCode: string,
): Promise<number> {
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
        regionCode?: string | null;
        sessionId?: string | null;
      }>;
    };
    const region = catalog.items?.find(
      (item) =>
        item.type === "REGION" &&
        (item.regionCode === regionCode ||
          (regionCode === "31220" && item.regionCode === "41550")) &&
        item.sessionId,
    );
    if (!region?.sessionId) return 0;
    const boardResponse = await fetch(
      new URL(`/api/backend/bingos/sessions/${region.sessionId}`, request.url),
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

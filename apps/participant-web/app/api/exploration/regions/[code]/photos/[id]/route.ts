import { NextResponse } from "next/server";

import { getReviewPhoto } from "../../../../../../../db/photo-storage";
import {
  getEligibleMemoryPhoto,
  resolveGuest,
} from "../../../../../../../db/photo-verifications";

const SUPPORTED_REGION_CODES = new Set(["31220"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await context.params;
  if (!SUPPORTED_REGION_CODES.has(code)) {
    return NextResponse.json({ error: "Unsupported region" }, { status: 404 });
  }
  const guest = resolveGuest(request);
  const photo = await getEligibleMemoryPhoto(guest.guestId, id);
  if (!photo?.photoKey) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  const object = await getReviewPhoto(photo.photoKey);
  if (!object) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "private, no-store",
    },
  });
}

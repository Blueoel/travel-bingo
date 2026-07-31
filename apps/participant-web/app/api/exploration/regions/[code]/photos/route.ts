import { NextResponse } from "next/server";

import {
  listEligibleMemoryPhotos,
  resolveGuest,
  withGuestCookie,
} from "../../../../../../db/photo-verifications";

const REGION_CODE_PATTERN = /^\d{2,10}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!REGION_CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Unsupported region" }, { status: 404 });
  }
  const guest = resolveGuest(request);
  try {
    const photos = await listEligibleMemoryPhotos(guest.guestId);
    return withGuestCookie(
      NextResponse.json({
        items: photos.map((photo) => ({
          id: photo.id,
          missionId: photo.missionId,
          missionTitle: photo.missionTitle,
          imageUrl: `/api/exploration/regions/${code}/photos/${photo.id}`,
          submittedAt: photo.submittedAt.toISOString(),
        })),
      }),
      guest,
    );
  } catch {
    return withGuestCookie(
      NextResponse.json({ items: [] }),
      guest,
    );
  }
}

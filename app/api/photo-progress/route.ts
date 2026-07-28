import { NextResponse } from "next/server";

import {
  getPhotoProgress,
  resolveGuest,
  withGuestCookie,
} from "../../../db/photo-verifications";

export async function GET(request: Request) {
  try {
    const guest = resolveGuest(request);
    const progress = await getPhotoProgress(guest.guestId);
    return withGuestCookie(NextResponse.json(progress), guest);
  } catch {
    return NextResponse.json(
      {
        code: "PHOTO_PROGRESS_UNAVAILABLE",
        message: "사진 미션 진행 기록을 불러오지 못했어요.",
      },
      { status: 503 },
    );
  }
}

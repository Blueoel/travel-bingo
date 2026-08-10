import { NextResponse } from "next/server";

import {
  requestGuestPhotoReview,
  resolveGuest,
  withGuestCookie,
} from "../../../db/photo-verifications";

export async function POST(request: Request) {
  const guest = resolveGuest(request);
  try {
    const input = (await request.json()) as { verificationId?: unknown };
    if (typeof input.verificationId !== "string") {
      return NextResponse.json(
        { message: "검수를 요청할 사진을 찾을 수 없어요." },
        { status: 400 },
      );
    }
    const requested = await requestGuestPhotoReview({
      guestId: guest.guestId,
      verificationId: input.verificationId,
    });
    if (!requested) {
      return withGuestCookie(
        NextResponse.json(
          { message: "이 사진은 관리자 검수를 요청할 수 없어요." },
          { status: 409 },
        ),
        guest,
      );
    }
    return withGuestCookie(
      NextResponse.json({ status: "NEEDS_REVIEW" }),
      guest,
    );
  } catch {
    return withGuestCookie(
      NextResponse.json(
        { message: "관리자 검수 요청을 접수하지 못했어요." },
        { status: 500 },
      ),
      guest,
    );
  }
}

import { NextResponse } from "next/server";

import { listPendingPhotoReviews } from "../../../../db/photo-verifications";

function adminEmail(request: Request): string | null {
  return request.headers.get("oai-authenticated-user-email");
}

export async function GET(request: Request) {
  if (!adminEmail(request)) {
    return NextResponse.json(
      { message: "관리자 로그인이 필요해요." },
      { status: 401 },
    );
  }
  const reviews = await listPendingPhotoReviews();
  return NextResponse.json({
    reviews: reviews.map((review) => ({
      ...review,
      evidence: JSON.parse(review.evidenceJson),
      failureReasons: JSON.parse(review.failureReasonsJson),
      imageUrl: `/api/admin/photo-reviews/${review.id}/image`,
    })),
  });
}

import { NextResponse } from "next/server";

import { decidePhotoReview } from "../../../../../db/photo-verifications";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const reviewerEmail = request.headers.get("oai-authenticated-user-email");
  if (!reviewerEmail) {
    return NextResponse.json(
      { message: "관리자 로그인이 필요해요." },
      { status: 401 },
    );
  }
  const body = (await request.json()) as { decision?: string };
  if (!["APPROVED", "REJECTED"].includes(body.decision ?? "")) {
    return NextResponse.json(
      { message: "올바른 판정을 선택해주세요." },
      { status: 400 },
    );
  }
  const { id } = await context.params;
  const result = await decidePhotoReview({
    verificationId: id,
    decision: body.decision as "APPROVED" | "REJECTED",
    reviewerEmail,
  });
  return NextResponse.json(result);
}

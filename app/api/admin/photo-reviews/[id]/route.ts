import { NextResponse } from "next/server";

import { decidePhotoReview } from "../../../../../db/photo-verifications";

const DEMO_ADMIN = "10000000-0000-4000-8000-000000000002";

function corsHeaders(request: Request): Record<string, string> {
  return {
    "access-control-allow-origin": request.headers.get("origin") ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-user-id",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const reviewerEmail =
    request.headers.get("oai-authenticated-user-email") ??
    (request.headers.get("x-user-id") === DEMO_ADMIN ? "demo-admin" : null);
  if (!reviewerEmail) {
    return NextResponse.json(
      { message: "관리자 로그인이 필요해요." },
      { status: 401, headers: corsHeaders(request) },
    );
  }
  const body = (await request.json()) as { decision?: string };
  if (!["APPROVED", "REJECTED"].includes(body.decision ?? "")) {
    return NextResponse.json(
      { message: "올바른 판정을 선택해주세요." },
      { status: 400, headers: corsHeaders(request) },
    );
  }
  const { id } = await context.params;
  const result = await decidePhotoReview({
    verificationId: id,
    decision: body.decision as "APPROVED" | "REJECTED",
    reviewerEmail,
  });
  return NextResponse.json(result, { headers: corsHeaders(request) });
}

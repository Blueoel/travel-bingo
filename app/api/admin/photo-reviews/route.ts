import { NextResponse } from "next/server";

import { listPhotoReviews } from "../../../../db/photo-verifications";

const DEMO_ADMIN = "10000000-0000-4000-8000-000000000002";

function adminEmail(request: Request): string | null {
  return (
    request.headers.get("oai-authenticated-user-email") ??
    (request.headers.get("x-user-id") === DEMO_ADMIN ? "demo-admin" : null)
  );
}

function corsHeaders(request: Request): Record<string, string> {
  return {
    "access-control-allow-origin": request.headers.get("origin") ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, x-user-id",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    vary: "origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  if (!adminEmail(request)) {
    return NextResponse.json(
      { message: "관리자 로그인이 필요해요." },
      { status: 401, headers: corsHeaders(request) },
    );
  }
  const processed =
    new URL(request.url).searchParams.get("status") === "history";
  const reviews = await listPhotoReviews(processed);
  return NextResponse.json(
    {
      reviews: reviews.map((review) => ({
        ...review,
        evidence: JSON.parse(review.evidenceJson),
        failureReasons: JSON.parse(review.failureReasonsJson),
        imageUrl: `/api/admin/photo-reviews/${review.id}/image`,
      })),
    },
    { headers: corsHeaders(request) },
  );
}

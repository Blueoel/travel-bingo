import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../../db";
import { getReviewPhoto } from "../../../../../../db/photo-storage";
import { photoVerificationAttempts } from "../../../../../../db/schema";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!request.headers.get("oai-authenticated-user-email")) {
    return NextResponse.json(
      { message: "관리자 로그인이 필요해요." },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  const db = await getDb();
  const [attempt] = await db
    .select({ photoKey: photoVerificationAttempts.photoKey })
    .from(photoVerificationAttempts)
    .where(eq(photoVerificationAttempts.id, id))
    .limit(1);
  if (!attempt?.photoKey) {
    return NextResponse.json(
      { message: "사진을 찾을 수 없어요." },
      { status: 404 },
    );
  }
  const object = await getReviewPhoto(attempt.photoKey);
  if (!object) {
    return NextResponse.json(
      { message: "사진을 찾을 수 없어요." },
      { status: 404 },
    );
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "private, no-store",
    },
  });
}

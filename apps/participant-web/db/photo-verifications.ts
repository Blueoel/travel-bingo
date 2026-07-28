import { and, eq, sum } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "./index";
import { photoMissionAwards, photoVerificationAttempts } from "./schema";

const GUEST_COOKIE = "travel_bingo_guest";

export type StoredPhotoVerdict = {
  decision: "APPROVED" | "REJECTED" | "NEEDS_REVIEW";
  targetVisible: boolean;
  confidence: number;
  evidence: string[];
  failureReasons: string[];
  retryGuide: string;
  model: string;
};

export function resolveGuest(request: Request): {
  guestId: string;
  shouldSetCookie: boolean;
} {
  const cookie = request.headers.get("cookie") ?? "";
  const encoded = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${GUEST_COOKIE}=`))
    ?.slice(GUEST_COOKIE.length + 1);
  const guestId = encoded ? decodeURIComponent(encoded) : crypto.randomUUID();
  return {
    guestId,
    shouldSetCookie: !encoded,
  };
}

export function withGuestCookie<T>(
  response: NextResponse<T>,
  guest: { guestId: string; shouldSetCookie: boolean },
): NextResponse<T> {
  if (guest.shouldSetCookie) {
    response.cookies.set(GUEST_COOKIE, guest.guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}

export function dailyDateInSeoul(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function recordPhotoVerdict(input: {
  guestId: string;
  missionId: string;
  missionTitle: string;
  points: number;
  verdict: StoredPhotoVerdict;
}): Promise<{ awardGranted: boolean; awardedPoints: number }> {
  const db = await getDb();
  const verificationId = crypto.randomUUID();
  const now = new Date();
  const dailyDate = dailyDateInSeoul(now);

  await db.insert(photoVerificationAttempts).values({
    id: verificationId,
    guestId: input.guestId,
    missionId: input.missionId,
    missionTitle: input.missionTitle,
    dailyDate,
    decision: input.verdict.decision,
    targetVisible: input.verdict.targetVisible,
    confidence: input.verdict.confidence,
    evidenceJson: JSON.stringify(input.verdict.evidence),
    failureReasonsJson: JSON.stringify(input.verdict.failureReasons),
    retryGuide: input.verdict.retryGuide || null,
    model: input.verdict.model,
    submittedAt: now,
  });

  if (input.verdict.decision !== "APPROVED") {
    return { awardGranted: false, awardedPoints: 0 };
  }

  const awarded = await db
    .insert(photoMissionAwards)
    .values({
      id: crypto.randomUUID(),
      verificationId,
      guestId: input.guestId,
      missionId: input.missionId,
      dailyDate,
      points: input.points,
      awardedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: photoMissionAwards.id });

  return {
    awardGranted: awarded.length === 1,
    awardedPoints: awarded.length === 1 ? input.points : 0,
  };
}

export async function getPhotoProgress(guestId: string): Promise<{
  missionIds: string[];
  totalPoints: number;
}> {
  const db = await getDb();
  const dailyDate = dailyDateInSeoul();
  const awards = await db
    .select({ missionId: photoMissionAwards.missionId })
    .from(photoMissionAwards)
    .where(
      and(
        eq(photoMissionAwards.guestId, guestId),
        eq(photoMissionAwards.dailyDate, dailyDate),
      ),
    );
  const totals = await db
    .select({ total: sum(photoMissionAwards.points) })
    .from(photoMissionAwards)
    .where(
      and(
        eq(photoMissionAwards.guestId, guestId),
        eq(photoMissionAwards.dailyDate, dailyDate),
      ),
    );

  return {
    missionIds: awards.map(({ missionId }) => missionId),
    totalPoints: Number(totals[0]?.total ?? 0),
  };
}

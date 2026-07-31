import { NextResponse } from "next/server";

import {
  resolveGuest,
  withGuestCookie,
} from "../../../../db/photo-verifications";

async function ensureTable(database: D1Database) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS exploration_region_memories (
        guest_id TEXT NOT NULL,
        region_code TEXT NOT NULL,
        photo_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        line_count INTEGER NOT NULL DEFAULT 3,
        selected_at INTEGER NOT NULL,
        PRIMARY KEY (guest_id, region_code)
      )`,
    )
    .run();
}

export async function GET(request: Request) {
  const guest = resolveGuest(request);
  try {
    const { env } = await import("cloudflare:workers");
    if (!env.DB) throw new Error("Database binding is unavailable.");
    await ensureTable(env.DB);
    const memories = await env.DB.prepare(
      `SELECT region_code AS regionCode, line_count AS lineCount,
              selected_at AS selectedAt
       FROM exploration_region_memories
       WHERE guest_id = ?
       ORDER BY selected_at DESC`,
    )
      .bind(guest.guestId)
      .all<{
        regionCode: string;
        lineCount: number;
        selectedAt: number;
      }>();
    return withGuestCookie(
      NextResponse.json({
        items: memories.results.map((memory) => ({
          regionCode: memory.regionCode,
          lineCount: memory.lineCount,
          unlocked: memory.lineCount >= 3,
          photoUrl: `/api/exploration/regions/${memory.regionCode}/photo?v=${memory.selectedAt}`,
          selectedAt: new Date(memory.selectedAt).toISOString(),
        })),
      }),
      guest,
    );
  } catch {
    return withGuestCookie(NextResponse.json({ items: [] }), guest);
  }
}

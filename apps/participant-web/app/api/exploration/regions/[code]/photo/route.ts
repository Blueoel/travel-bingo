import { getReviewPhoto } from "../../../../../../db/photo-storage";
import { resolveGuest } from "../../../../../../db/photo-verifications";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const guest = resolveGuest(request);
  try {
    const { env } = await import("cloudflare:workers");
    if (!env.DB) throw new Error("Database binding is unavailable.");
    const memory = await env.DB.prepare(
      `SELECT photo_key AS photoKey, mime_type AS mimeType
       FROM exploration_region_memories
       WHERE guest_id = ? AND region_code = ?`,
    )
      .bind(guest.guestId, code)
      .first<{ photoKey: string; mimeType: string }>();
    if (!memory) return new Response("Photo not found", { status: 404 });
    const photo = await getReviewPhoto(memory.photoKey);
    if (!photo) return new Response("Photo not found", { status: 404 });
    return new Response(photo.body, {
      headers: {
        "content-type": memory.mimeType,
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Photo not found", { status: 404 });
  }
}

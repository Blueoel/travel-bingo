export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const response = await fetch(new URL("/api/backend/travel-memories", request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" }, cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
  } catch {
    return Response.json({ items: [], error: "사진 정보를 불러오지 못했어요." }, { status: 503 });
  }
}

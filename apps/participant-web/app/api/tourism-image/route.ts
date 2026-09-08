const ALLOWED_HOSTS = new Set([
  "cdn.visitkorea.or.kr",
  "tong.visitkorea.or.kr",
]);

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("이미지 주소가 없습니다.", { status: 400 });

  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return new Response("올바르지 않은 이미지 주소입니다.", { status: 400 });
  }
  if (source.protocol !== "https:" || !ALLOWED_HOSTS.has(source.hostname)) {
    return new Response("허용되지 않은 이미지 주소입니다.", { status: 403 });
  }

  try {
    const upstream = await fetch(source, {
      headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("관광지 이미지를 불러오지 못했습니다.", { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("이미지 형식이 아닙니다.", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=604800, stale-if-error=2592000",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("관광지 이미지 연결이 지연되고 있습니다.", {
      status: 504,
      headers: { "cache-control": "public, max-age=60, stale-if-error=2592000" },
    });
  }
}

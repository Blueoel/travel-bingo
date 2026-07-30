const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyToApi(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyToApi(request, context);
}

async function proxyToApi(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const upstreamBase = (
    process.env.BACKEND_API_BASE_URL ?? "http://localhost:4000/api/v1"
  ).replace(/\/+$/, "");
  const adminApiKey = process.env.ADMIN_API_KEY?.trim();
  if (!adminApiKey) {
    return Response.json(
      { message: "관리자 API 인증 설정이 필요합니다." },
      { status: 503 },
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `${upstreamBase}/${path.map(encodeURIComponent).join("/")}`,
  );
  upstreamUrl.search = incomingUrl.search;

  const requestHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      requestHeaders.set(key, value);
    }
  });
  requestHeaders.set("x-user-id", adminApiKey);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: requestHeaders,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && key !== "set-cookie") {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { message: "관리자 API 서버에 연결하지 못했습니다." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

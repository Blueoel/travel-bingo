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

export async function DELETE(request: Request, context: RouteContext) {
  return proxyToApi(request, context);
}

async function proxyToApi(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const upstreamBase = (
    process.env.BACKEND_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:4000/api/v1"
  ).replace(/\/+$/, "");
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
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      responseHeaders.set("set-cookie", toFirstPartyCookie(setCookie));
    }
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        code: "BACKEND_API_UNAVAILABLE",
        message: "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

function toFirstPartyCookie(value: string): string {
  return value
    .replace(/;\s*Domain=[^;]+/gi, "")
    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
}

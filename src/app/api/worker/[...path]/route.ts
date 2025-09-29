import { NextRequest, NextResponse } from "next/server";

const TARGET = process.env.API_BASE_URL;
const FORWARD_HEADERS = new Set(["authorization", "content-type", "accept"]);

type RouteParams = {
  path: string[];
};

async function handler(
  req: NextRequest,
  ctx: { params: Promise<RouteParams> }
) {
  if (!TARGET) {
    return NextResponse.json(
      { error: "API_BASE_URL is not configured." },
      { status: 500 }
    );
  }

  const { path: rawSegments } = await ctx.params;
  const segments = Array.isArray(rawSegments) ? rawSegments : [];
  const base = TARGET.replace(/\/+$/, "");
  const path = segments.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${base}${path ? `/${path}` : ""}${search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers) {
    if (FORWARD_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : await req.arrayBuffer(),
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, init);
  } catch (error) {
    console.error("[api proxy] upstream fetch failed", error);
    return NextResponse.json(
      { error: "Upstream request failed." },
      { status: 502 }
    );
  }

  const upstreamHeaders = new Headers(upstreamResponse.headers);
  upstreamHeaders.delete("access-control-allow-origin");
  upstreamHeaders.delete("access-control-allow-credentials");
  upstreamHeaders.delete("access-control-allow-headers");
  upstreamHeaders.delete("access-control-allow-methods");
  upstreamHeaders.delete("access-control-max-age");

  if (req.method === "HEAD") {
    return new NextResponse(null, {
      status: upstreamResponse.status,
      headers: upstreamHeaders,
    });
  }

  const bodyBuffer = await upstreamResponse.arrayBuffer();
  upstreamHeaders.delete("content-encoding");
  upstreamHeaders.set("content-length", String(bodyBuffer.byteLength));

  return new NextResponse(bodyBuffer, {
    status: upstreamResponse.status,
    headers: upstreamHeaders,
  });
}

export { handler as DELETE };
export { handler as GET };
export { handler as HEAD };
export { handler as OPTIONS };
export { handler as PATCH };
export { handler as POST };
export { handler as PUT };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

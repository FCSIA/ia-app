import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    return Response.json(
      { message: "Missing CONVEX_SITE_URL" },
      { status: 500 }
    );
  }

  let convexSiteUrl: URL;
  try {
    convexSiteUrl = new URL(siteUrl);
  } catch {
    return Response.json(
      { message: "Invalid CONVEX_SITE_URL" },
      { status: 500 }
    );
  }

  const nextUrl = new URL("/impersonate", convexSiteUrl);
  const url = new URL(request.url);

  const headers = new Headers(request.headers);
  headers.delete("transfer-encoding");
  headers.delete("content-length");
  headers.delete("connection");
  headers.set("host", convexSiteUrl.host);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(/:$/, ""));
  headers.set("x-better-auth-forwarded-host", url.host);
  headers.set("x-better-auth-forwarded-proto", url.protocol.replace(/:$/, ""));

  const init: RequestInit = {
    method: "POST",
    headers,
    redirect: "manual",
  };

  const body = await request.arrayBuffer();
  if (body.byteLength > 0) {
    init.body = body;
  }

  const response = await fetch(nextUrl, init);
  return new Response(response.body, response);
}

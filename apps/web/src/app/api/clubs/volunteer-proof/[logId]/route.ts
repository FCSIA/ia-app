import { getToken } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  const { logId } = await params;
  if (!/^[a-z0-9]{10,64}$/.test(logId)) return new Response(null, { status: 404 });
  const token = await getToken();
  if (!token) return new Response(null, { status: 401 });
  const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
    (!process.env.CI ? "http://127.0.0.1:3211" : undefined);
  if (!siteUrl) return new Response(null, { status: 503 });
  try {
    const url = new URL("/club-volunteer-proof", siteUrl);
    url.searchParams.set("logId", logId);
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!upstream.ok) return new Response(null, { status: upstream.status === 401 ? 401 : 404 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

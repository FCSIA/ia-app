import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_URL ??
  (!process.env.CI ? 'http://127.0.0.1:3210' : undefined);

const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.CONVEX_SITE_URL ??
  (!process.env.CI ? 'http://127.0.0.1:3211' : undefined);

if (!convexUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_URL or CONVEX_URL is required.');
}

if (!convexSiteUrl) {
  throw new Error('NEXT_PUBLIC_CONVEX_SITE_URL or CONVEX_SITE_URL is required.');
}

const authSiteOrigin = convexSiteUrl;

const convexAuth = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});

export const { getToken, isAuthenticated, fetchAuthQuery, fetchAuthMutation } = convexAuth;

async function forwardAuthRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const authSiteUrl = new URL(authSiteOrigin);
  const headers = new Headers(request.headers);

  headers.delete('transfer-encoding');
  headers.delete('content-length');
  headers.delete('connection');
  headers.set('accept-encoding', 'application/json');
  headers.set('host', authSiteUrl.host);

  // Convex routes the request using this header before the Better Auth component
  // can restore the original public host. Keep it pointed at the Convex Site
  // endpoint and pass the browser origin only in the component's dedicated
  // restoration headers.
  headers.set('x-forwarded-host', authSiteUrl.host);
  headers.set('x-forwarded-proto', authSiteUrl.protocol.replace(/:$/, ''));
  headers.set('x-better-auth-forwarded-host', requestUrl.host);
  headers.set('x-better-auth-forwarded-proto', requestUrl.protocol.replace(/:$/, ''));

  const init: RequestInit = {
    headers,
    method: request.method,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  return fetch(`${authSiteOrigin}${requestUrl.pathname}${requestUrl.search}`, init);
}

export const handler = {
  GET: forwardAuthRequest,
  POST: forwardAuthRequest,
};

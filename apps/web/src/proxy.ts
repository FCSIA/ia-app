import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth-server';
import { isProtectedPathname } from '@/lib/routes';
import { api } from '~/apps/convex/src/_generated/api';

// The matcher below repeats this host as an escaped regex; Next needs it static.
const LEGACY_WEB_HOSTNAME = 'ia-app-alpha.vercel.app';
// `/_meta` is the deploy marker; it must answer even when the backend is down.
const PUBLIC_UTILITY_ROUTES = new Set(['/moved', '/pwa-setup', '/_meta']);

function requestHostname(request: NextRequest) {
  const host =
    request.headers.get('host') ??
    request.headers.get('x-forwarded-host') ??
    request.nextUrl.hostname;

  return host.split(',')[0]?.trim().replace(/:\d+$/, '').toLowerCase();
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep the former production hostname as a lightweight migration notice.
  if (
    requestHostname(request) === LEGACY_WEB_HOSTNAME &&
    pathname !== '/moved'
  ) {
    return NextResponse.redirect(new URL('/moved', request.url));
  }

  if (PUBLIC_UTILITY_ROUTES.has(pathname)) {
    const response = NextResponse.next();
    response.headers.set(
      'X-Robots-Tag',
      pathname === '/pwa-setup' || pathname === '/_meta' ? 'noindex, nofollow' : 'noindex, follow',
    );
    return response;
  }

  const isAuth = await isAuthenticated();
  const currentUser = isAuth
    ? await fetchAuthQuery(api.users.me.me, {}).catch(() => null)
    : null;
  const mustResetPassword = currentUser?.mustResetPassword === true;

  if (isProtectedPathname(pathname) && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isAuth &&
    mustResetPassword &&
    pathname !== '/change-password' &&
    pathname !== '/logout'
  ) {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  if (pathname === '/change-password' && isAuth && !mustResetPassword) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/login' && isAuth) {
    return NextResponse.redirect(
      new URL(mustResetPassword ? '/change-password' : '/', request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Intercept application requests on the former production hostname,
    // including stale clients making API requests.
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|favicon-dark.ico|icons|schedule-ocr-assets|sw.js).*)',
      has: [
        {
          type: 'header',
          key: 'host',
          value: 'ia-app-alpha\\.vercel\\.app',
        },
      ],
    },
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|schedule-ocr-assets|sw.js).*)',
      // Router prefetches do not need a second server-side redirect decision.
      // The destination's Convex functions remain the authorization boundary.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

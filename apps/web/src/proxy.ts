import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthenticated } from '@/lib/auth-server';
import { fetchAuthQuery } from '@/lib/auth-server';
import { api } from '~/apps/convex/src/_generated/api';

const LEGACY_WEB_HOSTNAME = 'ia-app-alpha.vercel.app';
const PUBLIC_UTILITY_ROUTES = new Set(['/moved', '/pwa-setup']);

function requestHostname(request: NextRequest) {
  const host =
    request.headers.get('host') ??
    request.headers.get('x-forwarded-host') ??
    request.nextUrl.hostname;

  return host.split(',')[0]?.trim().replace(/:\d+$/, '').toLowerCase();
}

/**
 * Next.js 16 Proxy (formerly Middleware)
 * Handles server-side routing logic like authentication redirects.
 * Runs on the Node.js runtime by default.
 */
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
      pathname === '/pwa-setup' ? 'noindex, nofollow' : 'noindex, follow',
    );
    return response;
  }

  const isAuth = await isAuthenticated();
  const currentUser = isAuth
    ? await fetchAuthQuery(api.users.me.me, {}).catch(() => null)
    : null;
  const mustResetPassword = currentUser?.mustResetPassword === true;

  // 1. Redirect unauthenticated users from protected routes to login
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/announcements',
    '/clubs',
    '/courses',
    '/schedule',
    '/events',
    '/calendar',
    '/flex-friday',
    '/wrapped',
    '/notifications',
    '/profile',
    '/change-password',
    '/report',
  ];
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    // Optionally preserve the original destination to redirect back after login
    // loginUrl.searchParams.set('callbackUrl', pathname);
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
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Redirect authenticated users away from the login page
  if (pathname === '/login' && isAuth) {
    return NextResponse.redirect(
      new URL(mustResetPassword ? '/change-password' : '/dashboard', request.url),
    );
  }

  // 3. Handle root path redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL(isAuth ? '/dashboard' : '/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Intercept application requests on the former production hostname,
    // including stale clients making API requests.
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|favicon-dark.ico|icons|sw.js).*)',
      has: [
        {
          type: 'header',
          key: 'host',
          value: 'ia-app-alpha\\.vercel\\.app',
        },
      ],
    },
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons (PWA icons)
     * - manifest.json (PWA manifest)
     * - sw.js (Service worker)
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
      // Router prefetches do not need a second server-side redirect decision.
      // The destination's Convex functions remain the authorization boundary.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

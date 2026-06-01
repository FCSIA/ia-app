import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthenticated } from '@/lib/auth-server';

/**
 * Next.js 16 Proxy (formerly Middleware)
 * Handles server-side routing logic like authentication redirects.
 * Runs on the Node.js runtime by default.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = await isAuthenticated();

  // 1. Redirect unauthenticated users from protected routes to login
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/announcements',
    '/clubs',
    '/schedule',
    '/events',
    '/calendar',
    '/flex-friday',
    '/wrapped',
    '/notifications',
    '/profile',
  ];
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuth) {
    const loginUrl = new URL('/login', request.url);
    // Optionally preserve the original destination to redirect back after login
    // loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirect authenticated users away from the login page
  if (pathname === '/login' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. Handle root path redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL(isAuth ? '/dashboard' : '/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
    '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
};

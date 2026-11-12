import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server';
import nextConfig from '../next.config';
import { config, proxy } from './proxy';

const auth = vi.hoisted(() => ({
  isAuthenticated: vi.fn<() => Promise<boolean>>(),
  fetchAuthQuery: vi.fn<() => Promise<{ mustResetPassword: boolean } | null>>(),
}));

vi.mock('@/lib/auth-server', () => auth);

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated.mockResolvedValue(false);
  auth.fetchAuthQuery.mockResolvedValue({ mustResetPassword: false });
});

describe('dashboard root routing', () => {
  it.each([
    { path: '/', signedIn: false, reset: false, destination: '/login' },
    { path: '/', signedIn: true, reset: false, destination: null },
    { path: '/', signedIn: true, reset: true, destination: '/change-password' },
    { path: '/login', signedIn: false, reset: false, destination: null },
    { path: '/login', signedIn: true, reset: false, destination: '/' },
    { path: '/login', signedIn: true, reset: true, destination: '/change-password' },
    { path: '/change-password', signedIn: true, reset: false, destination: '/' },
    { path: '/change-password', signedIn: true, reset: true, destination: null },
    { path: '/logout', signedIn: false, reset: false, destination: null },
    { path: '/logout', signedIn: true, reset: true, destination: null },
    { path: '/clubs', signedIn: false, reset: false, destination: '/login?next=%2Fclubs' },
    { path: '/route-finder', signedIn: false, reset: false, destination: '/login?next=%2Froute-finder' },
    { path: '/route-finder', signedIn: true, reset: false, destination: null },
    { path: '/route-finder', signedIn: true, reset: true, destination: '/change-password' },
    {
      path: '/device?user_code=ABCDEFGH',
      signedIn: false,
      reset: false,
      destination: '/login?next=%2Fdevice%3Fuser_code%3DABCDEFGH',
    },
    { path: '/login?next=%2Fdevice', signedIn: true, reset: false, destination: '/device' },
    { path: '/login?next=https%3A%2F%2Fevil.test', signedIn: true, reset: false, destination: '/' },
  ])('$path: signedIn=$signedIn, reset=$reset → $destination', async ({
    path, signedIn, reset, destination,
  }) => {
    auth.isAuthenticated.mockResolvedValue(signedIn);
    auth.fetchAuthQuery.mockResolvedValue({ mustResetPassword: reset });

    const response = await proxy(new NextRequest(`https://app.example${path}`));
    expect(response.headers.get('location')).toBe(
      destination === null ? null : `https://app.example${destination}`,
    );
    if (destination === null) expect(response.headers.get('x-middleware-next')).toBe('1');
    if (!signedIn) expect(auth.fetchAuthQuery).not.toHaveBeenCalled();
  });

  it('matches the root auth boundary without matching prefetches or static assets', () => {
    const matches = (url: string, headers = {}) =>
      unstable_doesMiddlewareMatch({ config, nextConfig, url, headers });
    expect(matches('https://app.example/')).toBe(true);
    expect(matches('https://app.example/?view=home')).toBe(true);
    expect(matches('https://app.example/', { 'next-router-prefetch': '1' })).toBe(false);
    expect(matches('https://app.example/manifest.json')).toBe(false);
  });

  it('permanently redirects old bookmarks and preserves their query parameters', async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: 'https://app.example/dashboard?view=home&tag=a',
      nextConfig,
    });
    expect(response.status).toBe(308);
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe('/');
    expect(destination.searchParams.get('view')).toBe('home');
    expect(destination.searchParams.get('tag')).toBe('a');
  });

  it('keeps the deploy marker independent of authentication', async () => {
    const response = await proxy(new NextRequest('https://app.example/_meta'));
    expect(response.headers.get('location')).toBeNull();
    expect(auth.isAuthenticated).not.toHaveBeenCalled();
  });
});

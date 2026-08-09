'use client';

import { useEffect } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type { AppRole } from '~/apps/convex/lib/roles';
import { api } from '~/apps/convex/src/_generated/api';

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;
export type CachedDisplayUser = Pick<AppUser, '_id' | 'firstName' | 'lastName' | 'avatarUrl'>;

const USER_CACHE_KEY = 'ia_user:v1';
const LEGACY_USER_CACHE_KEY = 'ia_user';

export function getUser(): CachedDisplayUser | null {
  if (typeof window === 'undefined') return null;
  localStorage.removeItem(LEGACY_USER_CACHE_KEY);
  const raw = localStorage.getItem(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedDisplayUser;
  } catch {
    return null;
  }
}

export function cacheUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    const display: CachedDisplayUser = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(display));
    localStorage.removeItem(LEGACY_USER_CACHE_KEY);
  } else {
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.removeItem(LEGACY_USER_CACHE_KEY);
  }
}

export function clearAuth() {
  localStorage.removeItem(USER_CACHE_KEY);
  localStorage.removeItem(LEGACY_USER_CACHE_KEY);
  localStorage.removeItem('ia_token');
  if ('caches' in window) void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_AUTH_CACHES' });
}

export function hasRole(user: AppUser | null, ...roles: AppRole[]): boolean {
  if (!user?.roles) return false;
  return roles.some((r) => user.roles.includes(r));
}

export function isAdmin(user: AppUser | null): boolean {
  return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
}

export function isSuperAdmin(user: AppUser | null): boolean {
  return hasRole(user, 'SUPER_ADMIN');
}

/**
 * Hook to access the current user.
 * Since Next.js 16 proxy.ts handles initial auth redirect, 
 * this hook focuses on providing the full user profile from Convex.
 */
export function useCurrentUser(): AppUser | null {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? {} : 'skip');
  useEffect(() => {
    if (user) {
      cacheUser(user);
    } else if (!isLoading && !isAuthenticated) {
      cacheUser(null);
    }
  }, [isAuthenticated, isLoading, user]);

  return user ?? null;
}

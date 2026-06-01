'use client';

import { useEffect, useState } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type { AppRole } from '~/apps/convex/lib/roles';
import { api } from '~/apps/convex/src/_generated/api';

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

export function getUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ia_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function cacheUser(user: AppUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('ia_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('ia_user');
  }
}

export function clearAuth() {
  localStorage.removeItem('ia_user');
  localStorage.removeItem('ia_token');
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
  const [cachedUser, setCachedUser] = useState<AppUser | null>(null);

  useEffect(() => {
    setCachedUser(getUser());
  }, []);

  useEffect(() => {
    if (user) {
      cacheUser(user);
      setCachedUser(user);
    } else if (!isLoading && !isAuthenticated) {
      cacheUser(null);
      setCachedUser(null);
    }
  }, [isAuthenticated, isLoading, user]);

  return user ?? cachedUser;
}

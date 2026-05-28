'use client';

import { useEffect, useState } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import type { AppRole } from '~/apps/convex/lib/roles';
import { api } from '~/apps/convex/src/_generated/api';

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Transitional only: old REST screens still read this until their domains move
  // to Convex. Better Auth sessions are cookie-based and do not use this token.
  return localStorage.getItem('ia_token');
}

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

export function setAuth(token: string, user: AppUser) {
  localStorage.setItem('ia_token', token);
  localStorage.setItem('ia_user', JSON.stringify(user));
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
  localStorage.removeItem('ia_token');
  localStorage.removeItem('ia_user');
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

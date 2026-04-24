'use client';

import { useEffect, useState } from 'react';
import type { AppRole, AppUser } from '@ia/contracts/auth';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
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
  const [user, setUser] = useState<AppUser | null>(null);
  useEffect(() => {
    setUser(getUser());
  }, []);
  return user;
}

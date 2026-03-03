'use client';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ia_token');
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ia_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: any) {
  localStorage.setItem('ia_token', token);
  localStorage.setItem('ia_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('ia_token');
  localStorage.removeItem('ia_user');
}

export function hasRole(user: any, ...roles: string[]): boolean {
  if (!user?.roles) return false;
  return roles.some((r) => user.roles.includes(r));
}

export function isAdmin(user: any): boolean {
  return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
}

export function isSuperAdmin(user: any): boolean {
  return hasRole(user, 'SUPER_ADMIN');
}

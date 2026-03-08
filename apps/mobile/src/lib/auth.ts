import * as SecureStore from 'expo-secure-store';
import type { AppRole, AppUser } from '@ia/contracts/auth';
import { TOKEN_KEY, USER_KEY } from './api';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<AppUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export async function setAuth(token: string, user: AppUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export function hasRole(user: AppUser | null, ...roles: AppRole[]): boolean {
  if (!user?.roles) return false;
  return roles.some((r) => user.roles.includes(r));
}

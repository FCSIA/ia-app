import { useConvexAuth, useQuery } from '@/lib/convex-react';
import type { FunctionReturnType } from 'convex/server';
import { removeStorage } from '@/lib/browser-storage';
import { api } from '~/apps/convex/src/_generated/api';

export type AppUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;

/** Keys that earlier versions cached the signed-in user under. */
const RETIRED_AUTH_KEYS = ['ia_user:v1', 'ia_user', 'ia_token'];

export function clearAuth() {
  for (const key of RETIRED_AUTH_KEYS) removeStorage(key);
  if ('caches' in window) void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_AUTH_CACHES' });
}

export function startLogout() {
  window.location.replace('/logout');
}

export function useCurrentUser(): AppUser | null {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.me.me, isAuthenticated ? {} : 'skip');
  return user ?? null;
}

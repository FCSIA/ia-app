'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export const ADMIN_TABS = [
  'users',
  'schedule',
  'administrator-roster',
  'moderation',
  'feedback',
  'wrapped',
  'audit',
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number];

const LEGACY_USER_TABS = new Set(['permissions', 'student-admins']);

export function resolveAdminTab(
  requestedTab: string | null,
  isSuperAdmin: boolean,
  canManageWrapped: boolean,
): AdminTabId {
  if (requestedTab && LEGACY_USER_TABS.has(requestedTab)) {
    return 'users';
  }

  if (requestedTab === 'schedule' && isSuperAdmin) return 'schedule';
  if (requestedTab === 'administrator-roster' && isSuperAdmin) return 'administrator-roster';
  if (requestedTab === 'feedback' && isSuperAdmin) return 'feedback';
  if (requestedTab === 'wrapped' && canManageWrapped) return 'wrapped';
  if (
    requestedTab === 'users' ||
    requestedTab === 'moderation' ||
    requestedTab === 'audit'
  ) {
    return requestedTab;
  }

  return 'users';
}

export function useAdminTab(isSuperAdmin: boolean, canManageWrapped: boolean) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get('tab') ?? null;

  const activeTab = resolveAdminTab(requestedTab, isSuperAdmin, canManageWrapped);

  useEffect(() => {
    if (requestedTab && LEGACY_USER_TABS.has(requestedTab)) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('tab');
      const query = params.toString();
      const path = pathname ?? '/admin';
      window.history.replaceState(null, '', query ? `${path}?${query}` : path);
    }
  }, [pathname, requestedTab, searchParams]);

  const setTab = useCallback(
    (tab: AdminTabId) => {
      const next = resolveAdminTab(tab, isSuperAdmin, canManageWrapped);

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === 'users') {
        params.delete('tab');
      } else {
        params.set('tab', next);
      }

      const query = params.toString();
      const path = pathname ?? '/admin';
      window.history.replaceState(null, '', query ? `${path}?${query}` : path);
    },
    [canManageWrapped, isSuperAdmin, pathname, searchParams],
  );

  return {
    activeTab,
    setActiveTab: setTab,
  };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export const ADMIN_TABS = [
  'users',
  'schedule',
  'moderation',
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get('tab') ?? null;

  const [activeTab, setActiveTab] = useState<AdminTabId>(() =>
    resolveAdminTab(requestedTab, isSuperAdmin, canManageWrapped),
  );

  useEffect(() => {
    const resolved = resolveAdminTab(requestedTab, isSuperAdmin, canManageWrapped);
    setActiveTab(resolved);

    if (requestedTab && LEGACY_USER_TABS.has(requestedTab)) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('tab');
      const query = params.toString();
      const path = pathname ?? '/admin';
      router.replace(query ? `${path}?${query}` : path, { scroll: false });
    }
  }, [canManageWrapped, isSuperAdmin, pathname, requestedTab, router, searchParams]);

  const selectedTab = resolveAdminTab(activeTab, isSuperAdmin, canManageWrapped);

  const setTab = useCallback(
    (tab: AdminTabId) => {
      const next = resolveAdminTab(tab, isSuperAdmin, canManageWrapped);
      setActiveTab(next);

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (next === 'users') {
        params.delete('tab');
      } else {
        params.set('tab', next);
      }

      const query = params.toString();
      const path = pathname ?? '/admin';
      router.replace(query ? `${path}?${query}` : path, { scroll: false });
    },
    [canManageWrapped, isSuperAdmin, pathname, router, searchParams],
  );

  return {
    activeTab: selectedTab,
    setActiveTab: setTab,
  };
}

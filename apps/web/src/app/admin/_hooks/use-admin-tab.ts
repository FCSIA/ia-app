'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export const ADMIN_TABS = [
  'users',
  'schedule',
  'moderation',
  'permissions',
  'student-admins',
  'wrapped',
  'audit',
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number];

export function resolveAdminTab(
  requestedTab: string | null,
  isSuperAdmin: boolean,
  canManageWrapped: boolean,
): AdminTabId {
  if (requestedTab === 'schedule' && isSuperAdmin) return 'schedule';
  if (requestedTab === 'wrapped' && canManageWrapped) return 'wrapped';
  if (
    requestedTab === 'users' ||
    requestedTab === 'moderation' ||
    requestedTab === 'permissions' ||
    requestedTab === 'student-admins' ||
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
    setActiveTab(resolveAdminTab(requestedTab, isSuperAdmin, canManageWrapped));
  }, [canManageWrapped, isSuperAdmin, requestedTab]);

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
    isUsersTab: selectedTab === 'users',
  };
}

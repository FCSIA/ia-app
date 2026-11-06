'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isLegacyUserTab, resolveAdminTab, type AdminAccess } from '../_lib/admin-sections';

export function useAdminTab(access: AdminAccess) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = pathname?.split('/')[2] ?? searchParams?.get('tab') ?? null;

  useEffect(() => {
    if (isLegacyUserTab(requestedTab)) {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('tab');
      const query = params.toString();
      const path = pathname ?? '/admin';
      window.history.replaceState(null, '', query ? `${path}?${query}` : path);
    }
  }, [pathname, requestedTab, searchParams]);

  return resolveAdminTab(requestedTab, access);
}

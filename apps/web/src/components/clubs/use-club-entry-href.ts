'use client';

import { useCallback, useEffect, useState } from 'react';
import { isMobilePwaDisplay } from '@/lib/pwa';

/**
 * Returns the appropriate first club screen for the current display context.
 * Desktop (and browser tabs) open the overview; installed mobile PWAs open the
 * dedicated navigation screen.
 */
export function useClubEntryHref() {
  const [isMobilePwa, setIsMobilePwa] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const displayQueries = [
      window.matchMedia('(display-mode: standalone)'),
      window.matchMedia('(display-mode: fullscreen)'),
      window.matchMedia('(display-mode: minimal-ui)'),
    ];
    const sync = () => setIsMobilePwa(isMobilePwaDisplay());

    sync();
    mobileQuery.addEventListener('change', sync);
    for (const query of displayQueries) query.addEventListener('change', sync);

    return () => {
      mobileQuery.removeEventListener('change', sync);
      for (const query of displayQueries) query.removeEventListener('change', sync);
    };
  }, []);

  return useCallback(
    (clubId: string) =>
      isMobilePwa ? `/clubs/${clubId}/navigation` : `/clubs/${clubId}`,
    [isMobilePwa],
  );
}

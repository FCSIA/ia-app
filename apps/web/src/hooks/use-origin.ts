'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => '';

/** The page's origin; empty during server render so links hydrate cleanly. */
export function useOrigin() {
  return useSyncExternalStore(subscribe, getClientOrigin, getServerOrigin);
}

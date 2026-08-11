'use client';

import { useEffect, useRef } from 'react';
import { clearAuth } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';

export default function LogoutPage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void authClient
      .signOut()
      .catch(() => {
        // Clear local state even when the server session is already gone.
      })
      .finally(() => {
        clearAuth();
        window.location.replace('/login');
      });
  }, []);

  return null;
}

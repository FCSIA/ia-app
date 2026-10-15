'use client';

import { useEffect, useRef, useState } from 'react';
import { clearAuth } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';
import { useConvexAuth, useMutation } from '@/lib/convex-react';
import { getCurrentPushSubscription } from '@/lib/push-notifications';
import { api } from '~/apps/convex/src/_generated/api';

// Signing out must never hang on push cleanup or on a session that will not
// restore; "Sign in again" sends stuck sessions here.
const authWaitMs = 2_000;
const pushReleaseTimeoutMs = 3_000;

export default function LogoutPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const removeSubscription = useMutation(api.notifications.push.removeSubscription);
  const started = useRef(false);
  const [authWaitExpired, setAuthWaitExpired] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setAuthWaitExpired(true), authWaitMs);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (started.current || (isLoading && !authWaitExpired)) return;
    started.current = true;

    // Stop this account's notifications on this browser while the session can
    // still say whose they are. The browser keeps its subscription, so the next
    // account to sign in here is registered for it instead.
    async function releasePush() {
      const subscription = await getCurrentPushSubscription();
      if (subscription) await removeSubscription({ endpoint: subscription.endpoint });
    }

    void (async () => {
      if (isAuthenticated) {
        await Promise.race([
          releasePush().catch(() => undefined),
          new Promise((resolve) => window.setTimeout(resolve, pushReleaseTimeoutMs)),
        ]);
      }
      await authClient.signOut().catch(() => {
        // Clear local state even when the server session is already gone.
      });
      clearAuth();
      window.location.replace('/login');
    })();
  }, [authWaitExpired, isAuthenticated, isLoading, removeSubscription]);

  return null;
}

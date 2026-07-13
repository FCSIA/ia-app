'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { Button } from '@/components/ui/button';
import {
  browserSupportsPush,
  getCurrentPushSubscription,
  permissionState,
  subscribeBrowserToPush,
  subscriptionToPayload,
} from '@/lib/push-notifications';

type PermissionStateLabel = NotificationPermission | 'unsupported' | 'checking';

export function PushNotificationSettings() {
  const publicKey = useQuery(api.notifications.push.getPublicKey);
  const serverSubscriptions = useQuery(api.notifications.push.listMine) ?? [];
  const upsertSubscription = useMutation(api.notifications.push.upsertSubscription);
  const removeSubscription = useMutation(api.notifications.push.removeSubscription);
  const activatePush = useMutation(api.notifications.preferences.activatePush);
  const [permission, setPermission] = useState<PermissionStateLabel>('checking');
  const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configuredPublicKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  useEffect(() => {
    let cancelled = false;

    async function readState() {
      const nextPermission = permissionState();
      const subscription = await getCurrentPushSubscription();
      if (cancelled) return;
      setPermission(nextPermission);
      setLocalEndpoint(subscription?.endpoint ?? null);
    }

    void readState();
    return () => {
      cancelled = true;
    };
  }, []);

  const serverHasThisDevice = serverSubscriptions.some((subscription) => subscription.endpoint === localEndpoint);
  const enabled = permission === 'granted' && !!localEndpoint && serverHasThisDevice;
  const unavailableReason = !browserSupportsPush()
    ? 'This browser does not support Web Push.'
    : configuredPublicKey === null
      ? 'Web Push is not configured for this environment.'
      : permission === 'denied'
        ? 'Notifications are blocked in your browser settings.'
        : null;

  async function enablePush() {
    if (!configuredPublicKey) return;
    setBusy(true);
    setError(null);
    try {
      const subscription = await subscribeBrowserToPush(configuredPublicKey);
      await upsertSubscription({
        subscription: subscriptionToPayload(subscription),
        userAgent: navigator.userAgent,
      });
      await activatePush({});
      setPermission(permissionState());
      setLocalEndpoint(subscription.endpoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError(null);
    try {
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        await removeSubscription({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setLocalEndpoint(null);
      setPermission(permissionState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable push notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {enabled ? (
              <BellRing className="size-4 text-primary" />
            ) : (
              <BellOff className="size-4 text-muted-foreground" />
            )}
            <h2 className="text-sm font-semibold">Browser push</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {enabled
              ? 'This browser can receive notifications after the tab is closed.'
              : 'Enable browser push to receive allowed notifications after closing the tab.'}
          </p>
          {unavailableReason ? <p className="mt-2 text-xs text-muted-foreground">{unavailableReason}</p> : null}
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={enabled ? 'secondary' : 'primary'}
          disabled={busy || !!unavailableReason || (publicKey === undefined && !configuredPublicKey)}
          onClick={() => void (enabled ? disablePush() : enablePush())}
          className="shrink-0"
        >
          {busy ? 'Saving...' : enabled ? 'Disable push' : 'Enable push'}
        </Button>
      </div>
    </section>
  );
}

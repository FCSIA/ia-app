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
  const unsupported = !browserSupportsPush();
  const keysLoading = publicKey === undefined && configuredPublicKey === null;
  const keysMissing = !keysLoading && configuredPublicKey === null;
  const blocked = permission === 'denied';
  const disabledReason = unsupported
    ? 'Unsupported browser'
    : keysMissing
      ? 'Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in web env and VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Convex.'
      : blocked
        ? 'Blocked in browser settings'
        : undefined;
  const statusLabel = enabled
    ? 'On'
    : keysLoading
      ? '...'
      : disabledReason
        ? 'Off'
        : 'Ready';

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
    <section className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2" title={disabledReason}>
          {enabled ? (
            <BellRing className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <BellOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <h2 className="truncate text-sm font-semibold">Browser push</h2>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{statusLabel}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant={enabled ? 'tertiary' : 'primary'}
          loading={busy}
          disabled={!!disabledReason || keysLoading}
          title={disabledReason}
          onClick={() => void (enabled ? disablePush() : enablePush())}
          className="shrink-0"
        >
          {enabled ? 'Disable push' : 'Enable push'}
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </section>
  );
}

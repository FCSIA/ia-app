'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, Share } from 'lucide-react';
import { useAction, useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Button } from '@/components/ui/button';
import {
  getCurrentPushSubscription,
  permissionState,
  pushAvailability,
  requestNotificationPermission,
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
  const sendTestPush = useAction(api.notifications.pushNode.sendTestToMe);
  const [permission, setPermission] = useState<PermissionStateLabel>('checking');
  const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ReturnType<typeof pushAvailability> | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configuredPublicKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  useEffect(() => {
    let cancelled = false;

    async function readState() {
      const nextAvailability = pushAvailability();
      const nextPermission = permissionState();
      const subscription =
        nextAvailability === 'supported' ? await getCurrentPushSubscription() : null;
      if (cancelled) return;
      setAvailability(nextAvailability);
      setPermission(nextPermission);
      setLocalEndpoint(subscription?.endpoint ?? null);
    }

    void readState();
    return () => {
      cancelled = true;
    };
  }, []);

  const serverHasThisDevice = serverSubscriptions.some(
    (subscription) => subscription.endpoint === localEndpoint,
  );
  const enabled = permission === 'granted' && !!localEndpoint && serverHasThisDevice;
  const needsIosInstall = availability === 'needs-ios-install';
  const unsupported = availability === 'unsupported';
  const keysLoading = publicKey === undefined && configuredPublicKey === null;
  const keysMissing = !keysLoading && configuredPublicKey === null;
  const blocked = permission === 'denied';
  const disabledReason = unsupported
    ? 'Unsupported browser'
    : needsIosInstall
      ? 'Add this app to your Home Screen first'
      : keysMissing
        ? 'Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in web env and VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in Convex.'
        : blocked
          ? 'Blocked in browser settings'
          : undefined;
  const statusLabel = enabled
    ? 'On'
    : keysLoading || availability === null
      ? '...'
      : needsIosInstall
        ? 'Setup needed'
        : disabledReason
          ? 'Off'
          : 'Ready';

  async function enablePush() {
    if (!configuredPublicKey) return;
    setBusy(true);
    setError(null);

    // Fired before any await so the browser still sees this as a direct
    // response to the tap. iOS rejects the prompt otherwise.
    const permissionRequest = requestNotificationPermission();

    try {
      const granted = await permissionRequest;
      setPermission(granted);
      if (granted !== 'granted') {
        throw new Error(
          granted === 'denied'
            ? 'Notifications are blocked. Enable them for this app in your device settings.'
            : 'Notification permission was not granted.',
        );
      }

      setTestResult(null);
      const subscription = await subscribeBrowserToPush(configuredPublicKey, granted);
      await upsertSubscription({
        subscription: subscriptionToPayload(subscription),
        userAgent: navigator.userAgent,
      });
      await activatePush({});
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
      setTestResult(null);
      setPermission(permissionState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable push notifications.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Prove the whole chain from this exact device.
   *
   * Everything between tapping Enable push and a notification appearing is
   * invisible from here: the push service can expire the endpoint, the
   * deployment can be missing VAPID keys, and Android can drop the message
   * without telling the page. This reports what the push service actually
   * said, so a device that looks enabled but stays silent can be told apart
   * from one that was never registered.
   */
  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const result = await sendTestPush({});
      if (result.delivered > 0) {
        setTestResult(
          `Sent to ${result.delivered} of ${result.attempted} registered ${
            result.attempted === 1 ? 'browser' : 'browsers'
          }. If nothing appears, check notification permissions for this app in your device settings.`,
        );
      } else {
        setError(result.errors[0] ?? 'The push service accepted nothing for this device.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a test notification.');
    } finally {
      setTesting(false);
    }
  }

  const deviceError = serverSubscriptions.find(
    (subscription) => subscription.endpoint === localEndpoint && subscription.lastError,
  )?.lastError;

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
        {needsIosInstall ? null : (
          <div className="flex shrink-0 items-center gap-2">
            {enabled ? (
              <Button
                type="button"
                size="sm"
                variant="tertiary"
                loading={testing}
                disabled={busy}
                onClick={() => void runTest()}
              >
                Send test
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={enabled ? 'tertiary' : 'primary'}
              loading={busy}
              disabled={!!disabledReason || keysLoading || availability === null || testing}
              title={disabledReason}
              onClick={() => void (enabled ? disablePush() : enablePush())}
            >
              {enabled ? 'Disable push' : 'Enable push'}
            </Button>
          </div>
        )}
      </div>
      {needsIosInstall ? (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Finish setup to get notifications on iPhone or iPad</p>
          <p className="mt-1">
            Apple only delivers notifications to web apps saved on the Home Screen. In Safari, tap
            the <Share className="inline size-3 align-[-2px]" aria-label="Share" /> Share button,
            choose <span className="font-medium text-foreground">Add to Home Screen</span>, then open
            the app from your Home Screen and turn on Browser push here.
          </p>
        </div>
      ) : null}
      {testResult ? <p className="text-xs text-muted-foreground">{testResult}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      {!error && deviceError ? (
        <p className="text-xs text-muted-foreground">
          Last delivery to this browser failed: {deviceError}
        </p>
      ) : null}
    </section>
  );
}

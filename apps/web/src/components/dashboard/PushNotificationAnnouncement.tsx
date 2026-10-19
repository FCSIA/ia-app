'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellOff, BellRing, X } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEnablePush, usePushReenablePrompt } from '@/components/notifications/enable-push';
import { useToast } from '@/hooks/use-toast';
import { useShape } from '@/lib/shape-context';
import { useQuery } from '@/lib/convex-react';
import { isPushOptedOut, permissionState, pushAvailability } from '@/lib/push-notifications';
import { devicePlatform } from '@/lib/pwa';
import { api } from '~/apps/convex/src/_generated/api';
import { cn } from '@/lib/utils';
import { getPushAnnouncement, type PushAnnouncementDevice } from './push-announcement';

const DISMISSED_AT_KEY = 'ia.push-reenable-announcement.dismissed-at.v1';
// Push can be lost again later, so a dismissal is not forever.
const DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Offers first-time desktop setup and the existing lost-push recovery flow.
 * Browser state is read after hydration and refreshed when settings change.
 */
export function PushNotificationAnnouncement() {
  const prompt = usePushReenablePrompt();
  const [device, setDevice] = useState<PushAnnouncementDevice | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const dismissedForSession = useRef(false);
  const announcement = getPushAnnouncement(device, prompt);
  const publicKey = useQuery(
    api.notifications.push.getPublicKey,
    announcement && dismissed === false ? {} : 'skip',
  );
  const configuredKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const enablePush = useEnablePush();
  const shape = useShape();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const refreshDevice = useCallback(() => {
    setDevice({
      platform: devicePlatform(),
      availability: pushAvailability(),
      permission: permissionState(),
      optedOut: isPushOptedOut(),
    });
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY));
      setDismissed(
        dismissedForSession.current ||
        (dismissedAt > 0 && Date.now() - dismissedAt < DISMISSAL_MS),
      );
    } catch {
      setDismissed((previous) => previous ?? false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let permissionStatus: PermissionStatus | undefined;
    refreshDevice();
    window.addEventListener('focus', refreshDevice);
    window.addEventListener('storage', refreshDevice);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshDevice();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Not every supported push browser exposes notification permissions here.
    // Focus/visibility and the action's finally handler cover those browsers.
    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: 'notifications' }).then((status) => {
        if (!active) return;
        permissionStatus = status;
        status.addEventListener('change', refreshDevice);
      }).catch(() => {});
    }

    return () => {
      active = false;
      window.removeEventListener('focus', refreshDevice);
      window.removeEventListener('storage', refreshDevice);
      document.removeEventListener('visibilitychange', onVisibility);
      permissionStatus?.removeEventListener('change', refreshDevice);
    };
  }, [refreshDevice]);

  if (!announcement || dismissed !== false || !configuredKey) {
    return null;
  }

  const blocked = announcement === 'blocked';
  const title = blocked
    ? 'Desktop notifications are blocked'
    : announcement === 'enable'
      ? 'Enable desktop notifications'
      : 'Off on this device';
  const description = blocked
    ? 'Allow notifications in your browser’s site settings.'
    : announcement === 'enable'
      ? 'Get announcements and messages on this browser.'
      : 'Turn them back on to keep getting announcements and messages.';
  const enableLabel = announcement === 'enable'
    ? 'Enable desktop notifications'
    : 'Turn notifications back on';

  const enable = () => {
    setBusy(true);
    // Called first, inside the tap, so iOS still shows the permission prompt.
    enablePush(configuredKey)
      .then(({ permission }) => {
        if (permission === 'denied') {
          toast({
            title: 'Notifications are blocked. Turn them on for this app in your device settings.',
            variant: 'destructive',
          });
        }
      })
      .catch((error: unknown) => {
        toast({
          title: error instanceof Error ? error.message : 'Could not turn on notifications',
          variant: 'destructive',
        });
      })
      .finally(() => {
        refreshDevice();
        setBusy(false);
      });
  };

  const dismiss = () => {
    dismissedForSession.current = true;
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
      // The announcement remains dismissed for this session if storage is unavailable.
    }
  };

  return (
    <CardGroup orientation="inline" border="outlined" proximityHover={false}>
      <Card className="bg-primary/10">
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center bg-primary/15 text-primary',
            shape.bg
          )}
        >
          <BellOff size={18} strokeWidth={1.5} />
        </span>
        <CardHeader className="py-3">
          <CardEyebrow className="text-primary/70">Notifications</CardEyebrow>
          <CardTitle className="min-w-0 truncate text-primary" title={title}>
            {title}
          </CardTitle>
          <CardDescription className="truncate text-primary/80" title={description}>
            {description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="pr-2">
          {!blocked ? (
            <Button
              type="button"
              size="icon-sm"
              loading={busy}
              aria-label={enableLabel}
              title={enableLabel}
              onClick={enable}
            >
              <BellRing />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss notifications announcement"
            disabled={busy}
            onClick={dismiss}
          >
            <X />
          </Button>
        </CardFooter>
      </Card>
    </CardGroup>
  );
}

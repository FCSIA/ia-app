'use client';

import { useEffect, useState } from 'react';
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
import { permissionState } from '@/lib/push-notifications';
import { api } from '~/apps/convex/src/_generated/api';
import { cn } from '@/lib/utils';

const DISMISSED_AT_KEY = 'ia.push-reenable-announcement.dismissed-at.v1';
// Push can be lost again later, so a dismissal is not forever.
const DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Offers to turn push back on for a device that silently lost it.
 *
 * iOS can reset a Home Screen app's notification permission to "ask" and drop
 * its subscription without telling anyone. Asking again needs a tap, so the
 * launch-time device report decides when to show this and the tap does the
 * rest.
 */
export function PushReenableAnnouncement() {
  const prompt = usePushReenablePrompt();
  const publicKey = useQuery(api.notifications.push.getPublicKey, prompt ? {} : 'skip');
  const configuredKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const enablePush = useEnablePush();
  const shape = useShape();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY));
      setDismissed(dismissedAt > 0 && Date.now() - dismissedAt < DISMISSAL_MS);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!prompt || dismissed !== false || !configuredKey || permissionState() !== 'default') {
    return null;
  }

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
      .finally(() => setBusy(false));
  };

  const dismiss = () => {
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
          <CardTitle className="min-w-0 truncate text-primary">Off on this device</CardTitle>
          <CardDescription className="truncate text-primary/80">
            Turn them back on to keep getting announcements and messages.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pr-2">
          <Button
            type="button"
            size="icon-sm"
            loading={busy}
            aria-label="Turn notifications back on"
            onClick={enable}
          >
            <BellRing />
          </Button>
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

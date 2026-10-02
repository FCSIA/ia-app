'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from '@/lib/convex-react';
import { Check, Link2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';

type RedemptionResult = FunctionReturnType<typeof api.schedule.shareLinks.redeem>;

export default function FriendLinkRedemptionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const preview = useQuery(api.schedule.shareLinks.preview, { token });
  const redeem = useMutation(api.schedule.shareLinks.redeem);
  const [result, setResult] = useState<RedemptionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      setResult(await redeem({ token }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This link could not be used.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AppShell>
      <PageFrame className="items-center pt-12 sm:pt-20">
        <main className={`w-full max-w-md overflow-hidden rounded-2xl bg-surface-2 shadow-surface-2 ${CARD_SURFACE_FOREGROUND}`}>
          {preview === undefined ? (
            <div className="animate-pulse space-y-4 p-6">
              <div className="mx-auto size-14 rounded-full bg-muted" />
              <div className="mx-auto h-5 w-48 rounded bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
            </div>
          ) : preview.state === 'INVALID' ? (
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Link2 className="size-5" />
              </div>
              <h1 className="text-lg font-semibold">Link unavailable</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                It may have expired or been revoked.
              </p>
              <Button asChild variant="secondary" className="mt-5 w-full">
                <Link href="/schedule?tab=friends">Open friend schedules</Link>
              </Button>
            </div>
          ) : preview.state === 'SELF' ? (
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Users className="size-5" />
              </div>
              <h1 className="text-lg font-semibold">This is your link</h1>
              <p className="mt-1 text-sm text-muted-foreground">Share it with another student.</p>
              <Button asChild variant="secondary" className="mt-5 w-full">
                <Link href="/schedule?tab=friends">Back to friend schedules</Link>
              </Button>
            </div>
          ) : result ? (
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Check className="size-5" />
              </div>
              <h1 className="text-lg font-semibold">
                {result.status === 'FRIENDS' || result.status === 'ALREADY_FRIENDS'
                  ? `You and ${result.owner.firstName} are friends`
                  : result.status === 'PENDING'
                    ? `${result.owner.firstName}'s request is already waiting`
                    : 'Friend request sent'}
              </h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {result.status === 'PENDING'
                  ? 'Open your requests to accept or decline it.'
                  : 'You can compare shared schedules from the Friends tab.'}
              </p>
              <Button asChild className="mt-5 w-full">
                <Link
                  href={
                    result.status === 'PENDING'
                      ? '/schedule?tab=friends&section=requests'
                      : `/schedule?tab=friends&friend=${result.owner._id}`
                  }
                >
                  Open friend schedules
                </Link>
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col items-center bg-surface-3 px-6 py-6 text-center">
                <UserAvatar
                  firstName={preview.owner!.firstName}
                  lastName={preview.owner!.lastName}
                  className="size-14"
                />
                <h1 className="mt-3 text-lg font-semibold">
                  Add {preview.owner!.firstName} {preview.owner!.lastName}
                </h1>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3 rounded-xl bg-surface-3 px-3 py-3">
                  {preview.mode === 'AUTO_ACCEPT' ? (
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <UserPlus className="mt-0.5 size-4 shrink-0 text-primary" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {preview.mode === 'AUTO_ACCEPT' ? 'Instant friendship' : 'Request approval'}
                      </p>
                      <Badge color="orange" size="sm">
                        {preview.mode === 'AUTO_ACCEPT' ? 'Auto-accept' : 'Request'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {preview.mode === 'AUTO_ACCEPT'
                        ? 'Continuing adds both of you as friends immediately.'
                        : `${preview.owner!.firstName} will receive a normal friend request to review.`}
                    </p>
                  </div>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button className="w-full" onClick={() => void handleRedeem()} disabled={pending}>
                  {pending
                    ? 'Working…'
                    : preview.mode === 'AUTO_ACCEPT'
                      ? 'Add us as friends'
                      : 'Send friend request'}
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/schedule?tab=friends">Cancel</Link>
                </Button>
              </div>
            </div>
          )}
        </main>
      </PageFrame>
    </AppShell>
  );
}

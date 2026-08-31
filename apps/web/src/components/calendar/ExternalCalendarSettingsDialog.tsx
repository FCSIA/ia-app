'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { RefreshCw, Settings, Trash2 } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const CANVAS_EXAMPLE = 'https://fultonschools.instructure.com/ical_feed';

export function ExternalCalendarSettingsDialog() {
  const { toast } = useToast();
  const subscriptions = useQuery(api.events.externalCalendars.listMine) ?? [];
  const create = useMutation(api.events.externalCalendars.createIcs);
  const remove = useMutation(api.events.externalCalendars.remove);
  const refresh = useMutation(api.events.externalCalendars.refreshMine);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Canvas');
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  async function addFeed(event: React.FormEvent) {
    event.preventDefault();
    setPending('add');
    try {
      await create({ displayName: name, feedUrl: url });
      setUrl('');
      toast({
        title: 'Calendar connected',
        description: 'Your first update has started.',
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not connect calendar',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    setPending(success);
    try {
      await action();
      toast({ title: success });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Calendar action failed',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="tertiary"
          size="icon-sm"
          aria-label="Calendar connections"
          title="Calendar connections"
        >
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Connect a calendar</DialogTitle>
          <DialogDescription>
            Add events from Canvas or another calendar. Connected calendars update
            automatically every six hours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {subscriptions.length > 0 && (
            <section
              className="space-y-2"
              aria-labelledby="connected-calendars-heading"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="connected-calendars-heading" className="text-sm font-semibold">
                  Connected calendars
                </h2>
                <span className="text-xs text-muted-foreground">Updates every 6 hours</span>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border">
                {subscriptions.map((subscription) => (
                  <div key={subscription._id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{subscription.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {subscription.status === 'ERROR'
                          ? subscription.lastError ?? 'Sync failed'
                          : subscription.lastSyncedAt
                            ? `Last updated ${new Date(subscription.lastSyncedAt).toLocaleString()}`
                            : 'Connecting now'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Update ${subscription.displayName} now`}
                      title="Update now"
                      loading={pending === 'Refresh requested'}
                      onClick={() =>
                        void runAction(
                          () => refresh({ subscriptionId: subscription._id }),
                          'Refresh requested',
                        )
                      }
                    >
                      <RefreshCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${subscription.displayName}`}
                      title="Remove calendar"
                      loading={pending === 'Calendar removed'}
                      onClick={() =>
                        void runAction(
                          () => remove({ subscriptionId: subscription._id }),
                          'Calendar removed',
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-3" aria-labelledby="canvas-feed-heading">
            <h2 id="canvas-feed-heading" className="text-sm font-semibold">
              Find your Canvas calendar link
            </h2>
            <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
              <li>
                Open <span className="font-medium text-foreground">Calendar</span> in
                Canvas.
              </li>
              <li>
                Select <span className="font-medium text-foreground">Calendar Feed</span>{' '}
                at the bottom of the page.
              </li>
              <li>Copy the calendar feed link, then paste it below.</li>
            </ol>
          </section>
          <form onSubmit={addFeed} className="space-y-4 border-t border-border pt-5">
            <div className="space-y-2">
              <Label htmlFor="external-calendar-name">Calendar name</Label>
              <Input
                id="external-calendar-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Canvas"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="external-calendar-url">Calendar feed link</Label>
              <Input
                id="external-calendar-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={CANVAS_EXAMPLE}
                required
              />
              <p className="text-xs text-muted-foreground">
                Your private link is stored securely and never shown on calendar events.
                HTTPS links only.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" loading={pending === 'add'}>
                Connect calendar
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

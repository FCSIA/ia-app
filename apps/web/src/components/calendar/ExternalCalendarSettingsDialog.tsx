'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { CalendarPlus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
      toast({ title: 'Calendar connected', description: 'Events will appear after the first sync.' });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : 'Could not connect calendar', variant: 'destructive' });
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
      toast({ title: error instanceof Error ? error.message : 'Calendar action failed', variant: 'destructive' });
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="tertiary" size="sm" leadingIcon={CalendarPlus}>Settings</Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Calendar connections</DialogTitle>
          <DialogDescription>Connect a private Canvas or other HTTPS ICS feed. Feed URLs stay private and are never shown in your calendar events.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {subscriptions.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {subscriptions.map((subscription) => (
                <div key={subscription._id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{subscription.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.status === 'ERROR' ? subscription.lastError ?? 'Sync failed' : subscription.lastSyncedAt ? `Synced ${new Date(subscription.lastSyncedAt).toLocaleString()}` : 'Waiting for first sync'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Refresh ${subscription.displayName}`} loading={pending === 'Refresh requested'} onClick={() => void runAction(() => refresh({ subscriptionId: subscription._id }), 'Refresh requested')}><RefreshCw /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${subscription.displayName}`} loading={pending === 'Calendar removed'} onClick={() => void runAction(() => remove({ subscriptionId: subscription._id }), 'Calendar removed')}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addFeed} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="external-calendar-name">Name</Label><Input id="external-calendar-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Canvas" maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="external-calendar-url">ICS feed URL</Label><Input id="external-calendar-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={CANVAS_EXAMPLE} required /><p className="text-xs text-muted-foreground">Use the personal calendar feed URL from Canvas, Google, or another calendar provider. HTTPS only.</p></div>
            <DialogFooter><Button type="submit" loading={pending === 'add'}>Connect ICS feed</Button></DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

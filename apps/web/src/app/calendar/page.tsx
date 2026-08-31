'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { MapPin, Plus } from 'lucide-react';

import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';
import { EditCalendarEntryDialog } from '@/components/calendar/EditCalendarEntryDialog';
import { ExternalCalendarSettingsDialog } from '@/components/calendar/ExternalCalendarSettingsDialog';
import { AppShell } from '@/components/layout/AppShell';
import { FILL_MAIN_CLASS } from '@/components/layout/app-main';
import { EventCalendar } from '@/components/reui/event-calendar/event-calendar';
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content';
import {
  EventCalendarNav,
  EventCalendarToolbar,
} from '@/components/reui/event-calendar/event-calendar-nav';
import type {
  CalendarEvent,
  CalendarView,
  EventCalendarRangeInfo,
} from '@/components/reui/event-calendar/event-calendar-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

type CalendarEntry = FunctionReturnType<typeof api.events.calendar.list>[number];

const SOURCE_COLORS: Record<CalendarEntry['source'], string> = {
  PERSONAL: 'var(--color-violet-500)',
  SCHOOL: 'var(--color-blue-500)',
  DISTRICT: 'var(--color-rose-500)',
  CLUB: 'var(--color-amber-500)',
  FLEX_FRIDAY: 'var(--color-emerald-500)',
  EXTERNAL: 'var(--color-teal-500)',
};

function initialRange() {
  const today = new Date();
  return {
    start: startOfWeek(startOfMonth(today)).getTime(),
    end: endOfWeek(endOfMonth(today)).getTime(),
  };
}

function CalendarInviteStrip() {
  const { toast } = useToast();
  const invites = useQuery(api.events.calendar.listPendingInvites) ?? [];
  const respondToInvite = useMutation(api.events.calendar.respondToInvite);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  const respond = async (inviteId: Id<'calendarInvites'>, accept: boolean) => {
    setPendingInviteId(inviteId);
    try {
      await respondToInvite({ inviteId, accept });
      toast({ title: accept ? 'Added to your calendar' : 'Invite declined' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not respond to invite',
        variant: 'destructive',
      });
    } finally {
      setPendingInviteId(null);
    }
  };

  return (
    <div className="flex shrink-0 gap-3 overflow-x-auto bg-muted/20 px-3 py-3 md:px-4">
      {invites.map((invite) => (
        <div
          key={invite._id}
          className="flex min-w-[17rem] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{invite.entry.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {format(new Date(invite.entry.startAt), 'MMM d, h:mm a')} ·{' '}
              {invite.sender.firstName} {invite.sender.lastName}
            </p>
          </div>
          <Button
            size="sm"
            disabled={pendingInviteId === invite._id}
            onClick={() => void respond(invite._id, true)}
          >
            Accept
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            disabled={pendingInviteId === invite._id}
            onClick={() => void respond(invite._id, false)}
          >
            Decline
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<CalendarView>('month');
  const [range, setRange] = useState(initialRange);
  const [activeEntry, setActiveEntry] = useState<CalendarEntry | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (isMobile && view !== 'agenda' && view !== 'day') setView('agenda');
  }, [isMobile, view]);

  const entries = useQuery(api.events.calendar.list, {
    startDate: range.start,
    endDate: range.end,
  });

  const events = useMemo<CalendarEvent<CalendarEntry>[]>(
    () =>
      (entries ?? []).map((entry) => {
        const start = new Date(entry.startAt);
        const requestedEnd = entry.endAt ? new Date(entry.endAt) : null;
        const end =
          requestedEnd && requestedEnd.getTime() > start.getTime()
            ? requestedEnd
            : new Date(start.getTime() + 60 * 60 * 1000);
        const allDay =
          start.getHours() === 0 &&
          start.getMinutes() === 0 &&
          end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000;

        return {
          id: entry._id,
          title: entry.title,
          start,
          end,
          allDay,
          color: SOURCE_COLORS[entry.source],
          readOnly: true,
          data: entry,
        };
      }),
    [entries],
  );

  const handleRangeChange = (info: EventCalendarRangeInfo) => {
    const next = { start: info.range.start.getTime(), end: info.range.end.getTime() };
    setRange((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  };

  const availableViews: CalendarView[] = isMobile
    ? ['agenda', 'day']
    : ['month', 'week', 'day', 'agenda'];
  const editableEntry = activeEntry?.source === 'EXTERNAL' ? null : activeEntry;
  const externalEntry = activeEntry?.source === 'EXTERNAL' ? activeEntry : null;

  if (!mounted) {
    return (
      <AppShell
        headerSlot={
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Calendar
          </h1>
        }
        mainClassName={FILL_MAIN_CLASS}
        pageTransitionClassName="flex min-h-0 flex-1 flex-col"
        viewportMode="visual"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center md:rounded-xl md:border md:border-border md:bg-card">
          <Skeleton className="h-5 w-32" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Calendar
        </h1>
      }
      mainClassName={FILL_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 flex-1 flex-col"
      viewportMode="visual"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border bg-card text-foreground md:rounded-xl md:border md:shadow-surface-1">
        <EventCalendar<CalendarEntry>
          events={events}
          view={view}
          onViewChange={setView}
          views={availableViews}
          loading={entries === undefined}
          interactions={{ drag: false, resize: false, selectSlot: false }}
          onRangeChange={handleRangeChange}
          onEventClick={(occurrence) => setActiveEntry(occurrence.event.data ?? null)}
          eventTooltip={!isMobile}
          enableShortcuts={!isMobile}
          scrollbars="native"
          className="min-h-0 flex-1"
        >
          <div className="shrink-0">
            <EventCalendarNav className="px-3 pt-3 md:px-4" />
            <EventCalendarToolbar className="flex-wrap px-3 pb-3 md:px-4">
              <ExternalCalendarSettingsDialog />
              <AddCalendarEntryDialog
                trigger={
                  <Button
                    size="icon"
                    aria-label="New reminder"
                    title="New reminder"
                    className="rounded-full"
                  >
                    <Plus />
                  </Button>
                }
              />
            </EventCalendarToolbar>
          </div>
          <CalendarInviteStrip />
          <EventCalendarContent />
        </EventCalendar>
      </div>

      {editableEntry ? (
        <EditCalendarEntryDialog
          entry={editableEntry}
          trigger={null}
          open
          onOpenChange={(open) => {
            if (!open) setActiveEntry(null);
          }}
        />
      ) : null}

      <Dialog
        open={externalEntry !== null}
        onOpenChange={(open) => {
          if (!open) setActiveEntry(null);
        }}
      >
        {externalEntry ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{externalEntry.title}</DialogTitle>
              <DialogDescription>
                {format(new Date(externalEntry.startAt), 'EEEE, MMMM d · h:mm a')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {externalEntry.location ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" aria-hidden="true" />
                  {externalEntry.location}
                </p>
              ) : null}
              {externalEntry.description ? <p>{externalEntry.description}</p> : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </AppShell>
  );
}

'use client';

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FunctionReturnType } from 'convex/server';
import { addDays, format, isValid } from 'date-fns';
import {
  ChevronDown,
  Mail,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { displayName, type PersonName } from '~/apps/shared/user-name';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useMutation, useQuery } from '@/lib/convex-react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';
import { EditCalendarEntryDialog } from '@/components/calendar/EditCalendarEntryDialog';
import { ExternalCalendarSettingsDialog } from '@/components/calendar/ExternalCalendarSettingsDialog';
import {
  CalendarDaySummary,
  CalendarSchoolDayBands,
} from '@/components/calendar/calendar-school-day';
import {
  calendarDate,
  calendarInputDate,
  CALENDAR_TIME_ZONE,
} from '@/components/calendar/calendar-date';
import {
  CALENDAR_SOURCES,
  CalendarEventRow,
  type CalendarSource,
} from '@/components/calendar/calendar-event-row';
import { AppShell } from '@/components/layout/AppShell';
import { FILL_MAIN_CLASS } from '@/components/layout/app-main';
import {
  EventCalendar,
  useEventCalendarNavigation,
} from '@/components/reui/event-calendar/event-calendar';
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content';
import {
  EventCalendarDatePicker,
  EventCalendarNavNext,
  EventCalendarNavPrev,
  EventCalendarNavToday,
} from '@/components/reui/event-calendar/event-calendar-nav';
import type {
  CalendarEvent,
  CalendarView,
  EventCalendarRangeInfo,
  EventCalendarSlotDraft,
} from '@/components/reui/event-calendar/event-calendar-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty } from '@/components/ui/empty';
import {
  FilterToggleGroup,
  FilterToggleItem,
} from '@/components/ui/filter-toggle-group';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabItem, TabPanel } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { defaultCalendarRange } from '@/lib/calendar-range';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

type CalendarEntry = FunctionReturnType<
  typeof api.events.calendar.list
>[number] & { inviteId?: Id<'calendarInvites'>; sharedBy?: PersonName };
const SOURCES = Object.keys(CALENDAR_SOURCES) as CalendarSource[];
const DESKTOP_VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda'];
const MOBILE_VIEWS: CalendarView[] = ['agenda', 'day', 'days'];
const VIEW_LABELS: Partial<Record<CalendarView, string>> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
  days: '3 days',
};

class InviteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <span role="status" className="text-xs text-muted-foreground">
        Invites unavailable
      </span>
    ) : (
      this.props.children
    );
  }
}

function CalendarInvites() {
  const user = useCurrentUser();
  const isMobile = useIsMobile();
  const isStudent =
    !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');
  const invites =
    useQuery(api.events.calendar.listPendingInvites, isStudent ? {} : 'skip') ??
    [];
  const respond = useMutation(api.events.calendar.respondToInvite);
  const [pending, setPending] = useState<string>();
  const { toast } = useToast();
  async function answer(inviteId: Id<'calendarInvites'>, accept: boolean) {
    setPending(inviteId);
    try {
      await respond({ inviteId, accept });
      toast({ title: accept ? 'Added to your calendar' : 'Invite declined' });
    } catch (cause) {
      toast({
        title:
          cause instanceof Error
            ? cause.message
            : 'Could not respond to the invite.',
        variant: 'destructive',
      });
    } finally {
      setPending(undefined);
    }
  }
  if (!isStudent) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="tertiary"
          size="sm"
          leadingIcon={Mail}
          aria-label={`Calendar invites, ${invites.length} pending`}
        >
          {isMobile
            ? invites.length || null
            : `Invites${invites.length ? ` (${invites.length})` : ''}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <p className="text-sm font-semibold">Calendar invites</p>
        {!invites.length ? (
          <p className="text-sm text-muted-foreground">No pending invites.</p>
        ) : (
          invites.map((invite) => (
            <div key={invite._id} className="space-y-2">
              <p className="truncate text-sm font-medium">
                {invite.entry.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(calendarDate(invite.entry.startAt), 'MMM d, h:mm a')} ·{' '}
                {displayName(invite.sender)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!!pending}
                  loading={pending === invite._id}
                  onClick={() => void answer(invite._id, true)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="tertiary"
                  disabled={!!pending}
                  onClick={() => void answer(invite._id, false)}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function PeriodHeader({
  isMobile,
  view,
}: {
  isMobile: boolean;
  view: CalendarView;
}) {
  const { title, date, activeRange } = useEventCalendarNavigation();
  const lastDay = calendarDate(activeRange.end.getTime() - 1);
  const compactTitle =
    view === 'days'
      ? `${format(calendarDate(activeRange.start), 'MMM d')}–${format(lastDay, calendarDate(activeRange.start).getMonth() === lastDay.getMonth() ? 'd' : 'MMM d')}`
      : format(calendarDate(date), 'MMM d');
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex shrink-0">
        <EventCalendarNavPrev />
        <EventCalendarNavNext />
      </div>
      <h1 className="min-w-0">
        <EventCalendarDatePicker
          className="max-w-full"
          aria-label={`Go to date, ${title}`}
        >
          <span className="truncate font-semibold">
            {isMobile ? compactTitle : title}
          </span>
          <ChevronDown aria-hidden="true" />
        </EventCalendarDatePicker>
      </h1>
      <span className="hidden sm:contents">
        <EventCalendarNavToday />
      </span>
    </div>
  );
}

function CalendarFallback() {
  return (
    <AppShell
      headerSlot={<h1 className="text-lg font-semibold">Calendar</h1>}
      mainClassName={FILL_MAIN_CLASS}
      viewportMode="visual"
    >
      <Skeleton className="h-full min-h-64 w-full" />
    </AppShell>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <CalendarMounted />
    </Suspense>
  );
}

function CalendarMounted() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? (
    <CalendarWorkspace isMobile={isMobile} />
  ) : (
    <CalendarFallback />
  );
}

function CalendarWorkspace({ isMobile }: { isMobile: boolean }) {
  const search = useSearchParams();
  const router = useRouter();
  const availableViews = isMobile ? MOBILE_VIEWS : DESKTOP_VIEWS;
  const requestedView = search?.get('view') as CalendarView | null;
  const initialDate = calendarInputDate(search?.get('date') ?? '');
  const [date, setDate] = useState(() =>
    isValid(initialDate) ? initialDate : new Date(),
  );
  const [view, setView] = useState<CalendarView>(() =>
    requestedView && availableViews.includes(requestedView)
      ? requestedView
      : isMobile
        ? 'agenda'
        : 'month',
  );
  const [range, setRange] = useState(defaultCalendarRange);
  const [sources, setSources] = useState<CalendarSource[]>(SOURCES);
  const [active, setActive] = useState<{
    entry: CalendarEntry;
    rect: DOMRect;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [createSlot, setCreateSlot] = useState<EventCalendarSlotDraft | null>(
    null,
  );
  const [feedsOpen, setFeedsOpen] = useState(
    search?.get('connect') === 'canvas',
  );
  const entries = useQuery(api.events.calendar.list, {
    startDate: range.start,
    endDate: range.end,
    sources,
  });
  const previous = useRef<CalendarEntry[]>([]);
  useEffect(() => {
    if (entries) previous.current = entries;
  }, [entries]);
  const displayed = entries ?? previous.current;

  // URL navigation, including browser Back, restores the same period and view.
  useEffect(() => {
    const nextDate = calendarInputDate(search?.get('date') ?? '');
    if (isValid(nextDate)) setDate(nextDate);
    const nextView = search?.get('view') as CalendarView | null;
    if (nextView && availableViews.includes(nextView)) setView(nextView);
    else
      setView((current) =>
        availableViews.includes(current)
          ? current
          : isMobile
            ? 'agenda'
            : 'month',
      );
  }, [search, isMobile, availableViews]);

  function navigate(nextView: CalendarView, nextDate: Date) {
    setView(nextView);
    setDate(nextDate);
    const params = new URLSearchParams(search?.toString());
    params.set('view', nextView);
    params.set('date', format(calendarDate(nextDate), 'yyyy-MM-dd'));
    router.replace(`/calendar?${params}`, { scroll: false });
  }
  const events = useMemo<CalendarEvent<CalendarEntry>[]>(
    () =>
      displayed
        .filter((entry) => sources.includes(entry.source))
        .map((entry) => {
          const start = new Date(entry.startAt);
          const end =
            entry.endAt && entry.endAt > entry.startAt
              ? new Date(entry.endAt)
              : new Date(entry.startAt + 3_600_000);
          return {
            id: entry._id,
            title: entry.title,
            start,
            end,
            allDay: entry.allDay ?? false,
            color: CALENDAR_SOURCES[entry.source].color,
            readOnly: true,
            data: entry,
          };
        }),
    [displayed, sources],
  );
  function rangeChanged(info: EventCalendarRangeInfo) {
    const next = {
      start: info.range.start.getTime(),
      end: info.range.end.getTime(),
    };
    setRange((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }
  function openSlot(start: Date, allDay: boolean) {
    setCreateSlot({
      start,
      end: allDay ? addDays(start, 1) : new Date(start.getTime() + 3_600_000),
      allDay,
      view,
    });
  }
  const owned =
    active?.entry.source === 'PERSONAL' &&
    !('inviteId' in active.entry && active.entry.inviteId)
      ? active.entry
      : null;
  const detail = active && !editing ? active.entry : null;
  const empty = (
    <Empty size="inline">
      <p>No events in this range.</p>
      <div className="flex gap-2">
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => openSlot(date, false)}
        >
          Add a reminder
        </Button>
        <Button variant="tertiary" size="sm" onClick={() => setFeedsOpen(true)}>
          Connect a calendar
        </Button>
      </div>
    </Empty>
  );

  return (
    <EventCalendar<CalendarEntry>
      events={events}
      view={view}
      date={date}
      timeZone={CALENDAR_TIME_ZONE}
      dayCount={3}
      dayCountPresets={[3]}
      onViewChange={(next) => navigate(next, date)}
      onDateChange={(next) => navigate(view, next)}
      views={availableViews}
      onRangeChange={rangeChanged}
      loading={entries === undefined}
      interactions={{ drag: false, resize: false, selectSlot: false }}
      onSlotClick={(slot) => openSlot(slot.date, slot.allDay)}
      onMoreClick={(day) => {
        navigate('day', day);
        return false;
      }}
      onEventClick={(occurrence, event) => {
        event.preventDefault();
        setEditing(false);
        if (occurrence.event.data)
          setActive({
            entry: occurrence.event.data,
            rect: event.currentTarget.getBoundingClientRect(),
          });
      }}
      eventTooltip={false}
      showDayAddButton
      enableShortcuts={!isMobile}
      scrollbars="native"
      scrollToHour={Math.min(
        7,
        ...events
          .filter((event) => !event.allDay)
          .map((event) => calendarDate(event.start).getHours()),
      )}
      renderAgendaEvent={({ occurrence }) =>
        occurrence.event.data ? (
          <CalendarEventRow
            entry={occurrence.event.data}
            start={occurrence.start}
            end={occurrence.end}
            allDay={occurrence.allDay}
          />
        ) : null
      }
      renderDayColumnBackground={(props) => (
        <CalendarSchoolDayBands {...props} />
      )}
      renderNoEvents={() => empty}
    >
      <AppShell
        headerSlot={<PeriodHeader isMobile={isMobile} view={view} />}
        mainClassName={FILL_MAIN_CLASS}
        pageTransitionClassName="flex min-h-0 flex-1 flex-col"
        viewportMode="visual"
      >
        <section
          aria-label="Calendar"
          tabIndex={0}
          className={`flex min-h-0 flex-1 flex-col bg-card md:overflow-hidden md:rounded-xl md:border md:border-border md:shadow-surface-1 ${CARD_SURFACE_FOREGROUND}`}
          onPointerDown={(e) => {
            if (
              !(e.target as HTMLElement).closest(
                'button,input,textarea,[role=tab]',
              )
            )
              e.currentTarget.focus({ preventScroll: true });
          }}
          onKeyDown={(e) => {
            if (
              e.altKey ||
              e.ctrlKey ||
              e.metaKey ||
              (e.target as HTMLElement).closest(
                'input,textarea,select,[contenteditable=true],[role=tab]',
              )
            )
              return;
            const shortcut: Record<string, CalendarView> = {
              m: 'month',
              w: 'week',
              d: 'day',
              a: 'agenda',
              '3': 'days',
            };
            if (e.key.toLowerCase() === 't') {
              e.preventDefault();
              navigate(view, new Date());
            } else if (
              shortcut[e.key.toLowerCase()] &&
              availableViews.includes(shortcut[e.key.toLowerCase()])
            ) {
              e.preventDefault();
              navigate(shortcut[e.key.toLowerCase()], date);
            }
          }}
        >
          <Tabs
            value={view}
            onValueChange={(next) => navigate(next as CalendarView, date)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 bg-muted/30 px-2 py-2 sm:px-3">
              <TabsList aria-label="Calendar view">
                {availableViews.map((item) => (
                  <TabItem
                    key={item}
                    value={item}
                    label={VIEW_LABELS[item] ?? item}
                  />
                ))}
              </TabsList>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="tertiary"
                      size={isMobile ? 'icon-compact' : 'sm'}
                      leadingIcon={isMobile ? undefined : SlidersHorizontal}
                      aria-label={`Calendar sources, ${sources.length} visible`}
                    >
                      {isMobile ? (
                        <SlidersHorizontal />
                      ) : (
                        `Sources${sources.length !== SOURCES.length ? ` (${sources.length})` : ''}`
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end">
                    <FilterToggleGroup
                      aria-label="Visible calendar sources"
                      value={sources}
                      onValueChange={(next) =>
                        setSources(next as CalendarSource[])
                      }
                    >
                      {SOURCES.map((source) => (
                        <FilterToggleItem key={source} value={source}>
                          <span
                            aria-hidden="true"
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: CALENDAR_SOURCES[source].color,
                            }}
                          />
                          {CALENDAR_SOURCES[source].label}
                        </FilterToggleItem>
                      ))}
                    </FilterToggleGroup>
                  </PopoverContent>
                </Popover>
                <InviteBoundary>
                  <CalendarInvites />
                </InviteBoundary>
                <AddCalendarEntryDialog
                  trigger={
                    <Button size="sm" leadingIcon={Plus}>
                      Reminder
                    </Button>
                  }
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-compact"
                      aria-label="Calendar options"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setFeedsOpen(true)}>
                      Calendar feeds
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => navigate(view, new Date())}
                    >
                      Go to today
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div
              className="h-0.5 shrink-0"
              role={entries === undefined ? 'progressbar' : undefined}
              aria-label={
                entries === undefined ? 'Updating calendar' : undefined
              }
            >
              {entries === undefined ? (
                <div className="h-full w-full animate-pulse bg-primary motion-reduce:animate-none" />
              ) : null}
            </div>
            {availableViews.map((item) => (
              <TabPanel
                key={item}
                value={item}
                className="flex min-h-0 flex-1 data-[state=inactive]:hidden"
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  {entries !== undefined && events.length === 0 ? (
                    empty
                  ) : (
                    <EventCalendarContent />
                  )}
                </div>
                {item === 'day' ? (
                  <CalendarDaySummary
                    day={date}
                    entries={displayed.filter(
                      (entry) =>
                        sources.includes(entry.source) &&
                        format(calendarDate(entry.startAt), 'yyyy-MM-dd') <=
                          format(calendarDate(date), 'yyyy-MM-dd') &&
                        format(
                          calendarDate(
                            (entry.endAt ?? entry.startAt) -
                              (entry.endAt ? 1 : 0),
                          ),
                          'yyyy-MM-dd',
                        ) >= format(calendarDate(date), 'yyyy-MM-dd'),
                    )}
                    onOpen={(entry, target) =>
                      setActive({ entry, rect: target.getBoundingClientRect() })
                    }
                    onCreate={() => openSlot(date, false)}
                  />
                ) : null}
              </TabPanel>
            ))}
          </Tabs>
        </section>
        {owned && editing ? (
          <EditCalendarEntryDialog
            key={owned._id}
            entry={owned}
            trigger={null}
            open
            onOpenChange={(open) => {
              if (!open) { setActive(null); setEditing(false); }
            }}
          />
        ) : null}
        <AddCalendarEntryDialog
          initialDate={createSlot?.start}
          allDay={createSlot?.allDay}
          durationMinutes={60}
          open={!!createSlot}
          onOpenChange={(open) => {
            if (!open) setCreateSlot(null);
          }}
          trigger={null}
        />
        <ExternalCalendarSettingsDialog
          trigger={null}
          open={feedsOpen}
          onOpenChange={setFeedsOpen}
        />
        <CalendarDetails
          entry={detail}
          rect={active?.rect}
          isMobile={isMobile}
          onEdit={owned ? () => setEditing(true) : undefined}
          onClose={() => setActive(null)}
        />
      </AppShell>
    </EventCalendar>
  );
}

function CalendarDetails({
  entry,
  rect,
  isMobile,
  onEdit,
  onClose,
}: {
  entry: CalendarEntry | null;
  rect?: DOMRect;
  isMobile: boolean;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const anchor = useRef({ getBoundingClientRect: () => rect ?? new DOMRect() });
  const removeShared = useMutation(api.events.calendar.removeSharedEntry);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  anchor.current.getBoundingClientRect = () => rect ?? new DOMRect();
  if (!entry) return null;
  const href =
    entry.source === 'EXTERNAL'
      ? entry.url
      : entry.eventId
        ? `/events/${entry.eventId}`
        : entry.flexFridayId
          ? '/flex-friday'
          : null;
  const date = format(
    calendarDate(entry.startAt),
    entry.allDay ? "EEEE, MMMM d · 'All day'" : 'EEEE, MMMM d · h:mm a',
  );
  const end = entry.endAt ? calendarDate(entry.endAt - (entry.allDay ? 1 : 0)) : null;
  const sameDay = end && format(calendarDate(entry.startAt), 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd');
  const when = end ? entry.allDay
    ? sameDay ? date : `${format(calendarDate(entry.startAt), 'EEEE, MMMM d')} – ${format(end, 'EEEE, MMMM d')} · All day`
    : `${date} – ${format(end, sameDay ? 'h:mm a' : 'EEEE, MMMM d · h:mm a')}` : date;
  const body = (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {entry.sharedBy
          ? `Shared by ${displayName(entry.sharedBy)}`
          : CALENDAR_SOURCES[entry.source].label}
        {entry.location ? ` · ${entry.location}` : ''}
      </p>
      {entry.description ? (
        <p className="whitespace-pre-line break-words">
          {href
            ? entry.description.replace(href, '').trim()
            : entry.description}
        </p>
      ) : null}
      {href ? (
        <Button asChild variant="tertiary" size="sm">
          <Link
            href={href}
            target={entry.source === 'EXTERNAL' ? '_blank' : undefined}
            rel={
              entry.source === 'EXTERNAL' ? 'noopener noreferrer' : undefined
            }
          >
            {entry.source === 'EXTERNAL'
              ? 'Open in source'
              : entry.flexFridayId
                ? 'Open Flex Friday'
                : 'Open event'}
          </Link>
        </Button>
      ) : null}
      {onEdit ? (
        <Button variant="tertiary" size="sm" onClick={onEdit}>
          Edit reminder
        </Button>
      ) : null}
      {entry.inviteId ? (
        <Button
          variant="tertiary"
          size="sm"
          loading={pending}
          onClick={() => {
            const inviteId = entry.inviteId;
            if (!inviteId) return;
            setPending(true);
            void removeShared({ inviteId })
              .then(() => {
                onClose();
                toast({ title: 'Removed from your calendar' });
              })
              .catch((cause: unknown) =>
                toast({
                  title:
                    cause instanceof Error
                      ? cause.message
                      : 'Could not remove the shared entry.',
                  variant: 'destructive',
                }),
              )
              .finally(() => setPending(false));
          }}
        >
          Remove from my calendar
        </Button>
      ) : null}
    </div>
  );
  return isMobile ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry.title}</DialogTitle>
          <DialogDescription>{when}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  ) : (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent align="start" className="w-80 space-y-3">
        <h2 className="text-base font-semibold">{entry.title}</h2>
        <p className="text-sm text-muted-foreground">{when}</p>
        {body}
      </PopoverContent>
    </Popover>
  );
}

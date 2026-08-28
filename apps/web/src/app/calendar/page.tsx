'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { FILL_MAIN_CLASS } from '@/components/layout/app-main';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfWeek,
  endOfWeek,
  isToday,
} from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, AlignJustify, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';
import { EditCalendarEntryDialog } from '@/components/calendar/EditCalendarEntryDialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ExternalCalendarSettingsDialog } from '@/components/calendar/ExternalCalendarSettingsDialog';

export type CalendarSource = 'DISTRICT' | 'SCHOOL' | 'CLUB' | 'PERSONAL' | 'FLEX_FRIDAY' | 'EXTERNAL';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_COLORS: Record<CalendarSource, { bg: string; text: string; dot: string; isMultiDay?: boolean }> = {
  PERSONAL: { bg: 'hsl(var(--accent))', text: 'hsl(var(--foreground))', dot: '#a855f7' },
  SCHOOL:   { bg: 'hsl(var(--accent))', text: 'hsl(var(--foreground))', dot: '#3b82f6' },
  DISTRICT: { bg: 'color-mix(in srgb, #f43f5e 18%, hsl(var(--card)))', text: 'hsl(var(--foreground))', dot: '#f43f5e', isMultiDay: true },
  CLUB:     { bg: 'hsl(var(--accent))', text: 'hsl(var(--foreground))', dot: '#eab308' },
  FLEX_FRIDAY: { bg: 'hsl(var(--accent))', text: 'hsl(var(--foreground))', dot: '#22c55e' },
  EXTERNAL: { bg: 'hsl(var(--accent))', text: 'hsl(var(--foreground))', dot: '#14b8a6' },
};

// Mock resources for the Resource view matching the screenshot
const MOCK_RESOURCES = [
  { id: '101', name: 'Room 101' },
  { id: '102', name: 'Room 102' },
  { id: 'gym', name: 'Main Gym' },
  { id: 'lib', name: 'Library' },
];

const calculateEventStyles = (startAt: number, endAt: number | undefined, startHour: number, pixelsPerHour: number) => {
  const startDate = new Date(startAt);
  const startHours = startDate.getHours() + startDate.getMinutes() / 60;
  
  // Calculate relative to the view's start hour in pixels
  const top = Math.max(0, (startHours - startHour) * pixelsPerHour);
  
  // Default to 1 hour if endAt is missing
  let durationHours = 1; 
  if (endAt) {
    durationHours = (endAt - startAt) / (1000 * 60 * 60);
  }
  
  const height = Math.max(20, durationHours * pixelsPerHour); // min height 20px
  
  return { top, height };
};

const matchResource = (location: string | undefined, resources: typeof MOCK_RESOURCES) => {
  if (!location) return null;
  const loc = location.toLowerCase();
  return resources.find(r => loc.includes(r.id.toLowerCase()) || loc.includes(r.name.toLowerCase()));
};

const processOverlaps = (events: any[]) => {
  if (events.length === 0) return [];
  
  const sorted = [...events].sort((a, b) => a.startAt - b.startAt);
  const result: any[] = [];
  
  let currentCluster: any[] = [];
  let clusterEnd = 0;

  const processCluster = (cluster: any[]) => {
    const columns: any[][] = [];
    for (const ev of cluster) {
      const evStart = ev.startAt;
      let placed = false;
      for (const col of columns) {
        const lastEv = col[col.length - 1];
        const lastEnd = lastEv.endAt || lastEv.startAt + 3600000;
        if (lastEnd <= evStart) {
          col.push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([ev]);
    }
    
    const numColumns = columns.length;
    for (let c = 0; c < numColumns; c++) {
      for (const ev of columns[c]) {
        result.push({
          event: ev,
          leftPercent: (c / numColumns) * 100,
          widthPercent: 100 / numColumns,
        });
      }
    }
  };

  for (const ev of sorted) {
    const evStart = ev.startAt;
    const evEnd = ev.endAt || ev.startAt + 3600000;
    
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = evEnd;
    } else if (evStart < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, evEnd);
    } else {
      processCluster(currentCluster);
      currentCluster = [ev];
      clusterEnd = evEnd;
    }
  }
  if (currentCluster.length > 0) {
    processCluster(currentCluster);
  }
  
  return result;
};

function EventInteraction({ onOpen, children }: { onOpen: () => void, children: (props: { expanded: boolean, onClick: (e: any) => void, onDoubleClick: (e: any) => void }) => React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <>
      {children({
        expanded,
        onClick: (e: any) => { e.stopPropagation(); setExpanded(!expanded); },
        onDoubleClick: (e: any) => { e.stopPropagation(); onOpen(); }
      })}
    </>
  );
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
    <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-border bg-muted/20 px-4 py-3 md:px-6">
      {invites.map((invite) => (
        <div key={invite._id} className="flex min-w-[280px] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{invite.entry.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {format(new Date(invite.entry.startAt), 'MMM d, h:mm a')} · {invite.sender.firstName} {invite.sender.lastName}
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [view, setView] = useState<'month' | 'day' | 'resource'>('day');
  
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calStart = startOfWeek(startOfMonth(currentMonth));
  const calEnd = endOfWeek(endOfMonth(currentMonth));
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const entries =
    useQuery(api.events.calendar.list, {
      startDate: calStart.getTime(),
      endDate: calEnd.getTime(),
    }) ?? [];

  if (!isMounted) {
    return (
      <AppShell
        mainClassName={FILL_MAIN_CLASS}
        pageTransitionClassName="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-surface-1">
          <Skeleton className="h-5 w-32" />
        </div>
      </AppShell>
    );
  }

  const getEventsForDay = (day: Date) =>
    (entries as any[]).filter((e) => isSameDay(new Date(e.startAt), day));

  const prevMonth = () => {
    if (view === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    } else {
      setSelectedDay(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() - 1));
    }
  };
  
  const nextMonth = () => {
    if (view === 'month') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    } else {
      setSelectedDay(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() + 1));
    }
  };

  const getSourceColor = (source: CalendarSource) =>
    SOURCE_COLORS[source] ?? SOURCE_COLORS.SCHOOL;

  // --- Views ---

  const renderMonthView = () => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Day of week headers */}
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted/30">
        {DAY_LABELS.map((d) => (
          <div key={d} className="px-4 py-3 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = isSameDay(day, selectedDay);
          const isTodays = isToday(day);
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => {
                setSelectedDay(day);
                // Optionally switch to day view when clicking a day? Keeping as month for now.
              }}
              className={cn(
                'group relative flex min-h-[120px] cursor-pointer flex-col border-border p-1.5',
                !isCurrentMonth ? 'bg-muted/20 text-muted-foreground/60' : 'hover:bg-hover',
                i % 7 !== 6 && 'border-r',
                i < days.length - 7 && 'border-b',
                isSelected && 'bg-active',
              )}
            >
              <div className="flex-1 flex flex-col gap-1 overflow-hidden pt-1">
                {dayEvents.slice(0, 3).map((e: any) => {
                  const color = getSourceColor(e.source as CalendarSource);
                  if (color.isMultiDay) {
                    return (
                      <EditCalendarEntryDialog
                        key={e._id}
                        entry={e}
                        trigger={(onOpen) => (
                          <EventInteraction onOpen={onOpen}>
                            {({ expanded, onClick, onDoubleClick }) => (
                              <div 
                                onClick={onClick}
                                onDoubleClick={onDoubleClick}
                                className={cn('relative mx-0.5 cursor-pointer rounded border border-border px-2 py-1 text-xs font-medium shadow-sm hover:opacity-90', expanded ? 'z-50 h-auto whitespace-normal break-words' : 'z-10 truncate')}
                                style={{ backgroundColor: color.bg, color: color.text }}
                              >
                                {e.title}
                              </div>
                            )}
                          </EventInteraction>
                        )}
                      />
                    );
                  }
                  return (
                    <EditCalendarEntryDialog
                      key={e._id}
                      entry={e}
                      trigger={(onOpen) => (
                        <EventInteraction onOpen={onOpen}>
                          {({ expanded, onClick, onDoubleClick }) => (
                            <div 
                              onClick={onClick}
                              onDoubleClick={onDoubleClick}
                              className={cn('mx-0.5 flex cursor-pointer items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-hover', expanded && 'z-50 h-auto whitespace-normal break-words')}
                            >
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.dot }} />
                              <span className={cn('flex-1', !expanded && 'truncate')}>{e.title}</span>
                              <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">{format(new Date(e.startAt), 'h:mm a')}</span>
                            </div>
                          )}
                        </EventInteraction>
                      )}
                    />
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="mx-1 mt-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 right-2 flex items-center justify-center">
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    isTodays
                      ? 'bg-foreground text-background'
                      : isCurrentMonth
                        ? 'text-muted-foreground group-hover:text-foreground'
                        : 'text-muted-foreground/60',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
            </div>
          );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  const renderDayView = () => {
    // Generate hours from 12 AM to 11 PM
    const hours = Array.from({ length: 24 }, (_, i) => i); 
    const dayEvents = getEventsForDay(selectedDay);

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Day Header */}
        <div className="flex shrink-0 border-b border-border bg-muted/30">
          <div className="w-16 shrink-0 border-r border-border" />
          <div className="flex-1 px-4 py-3 text-sm font-medium text-foreground">
            {format(selectedDay, 'EEE d')}
          </div>
        </div>
        
        {/* All Day Section */}
        <div className="flex shrink-0 border-b border-border bg-muted/30">
          <div className="flex w-16 shrink-0 items-center justify-center border-r border-border py-2 text-xs text-muted-foreground">
            All day
          </div>
          <div className="flex-1 p-1">
            {/* Mock an all day event or multi day event here if needed */}
          </div>
        </div>

        {/* Time Grid */}
        <ScrollArea className="relative min-h-0 flex-1">
          <div className="flex min-h-[1920px]">
            {/* Time labels */}
            <div className="relative w-16 shrink-0 border-r border-border bg-background">
              {hours.map((hour) => (
                <div key={hour} className="relative h-20 border-b border-border/60">
                  <span className={cn('absolute right-2 text-[10px] font-medium text-muted-foreground', hour === 0 ? 'top-1' : '-top-2.5')}>
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid lines and events */}
            <div className="flex-1 relative">
              {hours.map((hour) => (
                <div key={hour} className="h-20 border-b border-border/60" />
              ))}
              
              {/* Current Time Line (Red) */}
              {isToday(selectedDay) && (
                <div className="absolute left-0 right-0 h-px bg-red-500 z-20 flex items-center pointer-events-none" style={{ top: `${calculateEventStyles(Date.now(), undefined, 0, 80).top}px` }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5" />
                </div>
              )}

              {/* Render Events */}
              {processOverlaps(dayEvents).map(({ event: e, leftPercent, widthPercent }: any) => {
                const { top, height } = calculateEventStyles(e.startAt, e.endAt, 0, 80);
                const color = getSourceColor(e.source as CalendarSource);

                return (
                  <EditCalendarEntryDialog
                    key={e._id}
                    entry={e}
                    trigger={(onOpen) => (
                      <EventInteraction onOpen={onOpen}>
                        {({ expanded, onClick, onDoubleClick }) => (
                          <div 
                            onClick={onClick}
                            onDoubleClick={onDoubleClick}
                            className={cn('absolute flex cursor-pointer flex-col overflow-hidden rounded-md border border-border p-2 text-foreground shadow-md transition-shadow hover:ring-2 hover:ring-ring/30', expanded && 'z-50')}
                            style={{ 
                              top: `${top}px`, 
                              height: expanded ? 'auto' : `${height}px`,
                              minHeight: `${height}px`,
                              left: `calc(0.5rem + ${leftPercent}%)`,
                              width: `calc(${widthPercent}% - 1.5rem)`,
                              backgroundColor: color.bg,
                              borderLeft: `4px solid ${color.dot}`
                            }}
                          >
                            <div className="pl-1 flex items-center gap-2">
                              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                                {e.title.charAt(0)}
                              </div>
                              <span className={cn('text-sm font-semibold', expanded ? 'whitespace-normal break-words' : 'truncate')}>{e.title}</span>
                            </div>
                            <span className={cn('mt-0.5 pl-9 text-xs font-medium text-muted-foreground', expanded ? 'whitespace-normal break-words' : 'truncate')}>
                              {e.location && `${e.location} • `}{format(new Date(e.startAt), 'h:mm a')}
                            </span>
                          </div>
                        )}
                      </EventInteraction>
                    )}
                  />
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderResourceView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0 to 23
    const dayEvents = getEventsForDay(selectedDay);

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Resource Headers */}
        <div className="flex shrink-0 border-b border-border bg-muted/30">
          <div className="w-16 shrink-0 border-r border-border" />
          {MOCK_RESOURCES.map((r) => (
            <div key={r.id} className="flex-1 border-r border-border py-3 text-center text-sm font-medium text-foreground">
              {r.name}
            </div>
          ))}
        </div>

        {/* All Day Section */}
        <div className="flex shrink-0 border-b border-border bg-muted/30">
          <div className="flex w-16 shrink-0 items-center justify-center border-r border-border py-2 text-xs text-muted-foreground">
            All day
          </div>
          {MOCK_RESOURCES.map((r) => (
            <div key={r.id} className="flex-1 border-r border-border" />
          ))}
        </div>

        {/* Time Grid & Resources */}
        <ScrollArea className="relative min-h-0 flex-1">
          <div className="flex min-h-[2304px]">
            {/* Time labels */}
            <div className="relative w-16 shrink-0 border-r border-border bg-background">
              {hours.map((hour) => (
                <div key={hour} className="relative h-24 border-b border-border/60">
                  <span className={cn('absolute right-2 text-[10px] font-medium text-muted-foreground', hour === 0 ? 'top-1' : '-top-2.5')}>
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Resource Columns */}
            {MOCK_RESOURCES.map((r, colIndex) => (
              <div key={r.id} className="relative flex-1 border-r border-border">
                {hours.map((hour) => (
                  <div key={hour} className="h-24 border-b border-border/60" />
                ))}

                {/* Event Blocks */}
                {processOverlaps(dayEvents.filter((e: any) => {
                  const matchedResource = matchResource(e.location, MOCK_RESOURCES);
                  return matchedResource ? matchedResource.id === r.id : colIndex === 0;
                })).map(({ event: e, leftPercent, widthPercent }: any) => {
                  const { top, height } = calculateEventStyles(e.startAt, e.endAt, 0, 96);
                  const color = getSourceColor(e.source as CalendarSource);
                  
                  return (
                    <EditCalendarEntryDialog
                      key={e._id}
                      entry={e}
                      trigger={(onOpen) => (
                        <EventInteraction onOpen={onOpen}>
                          {({ expanded, onClick, onDoubleClick }) => (
                            <div 
                              onClick={onClick}
                              onDoubleClick={onDoubleClick}
                              className={cn('absolute flex cursor-pointer flex-col overflow-hidden rounded-sm border border-border p-2 text-foreground transition-shadow hover:ring-2 hover:ring-ring/30', expanded && 'z-50')}
                              style={{ 
                                top: `${top}px`, 
                                height: expanded ? 'auto' : `${height}px`,
                                minHeight: `${height}px`,
                                left: `calc(0.25rem + ${leftPercent}%)`,
                                width: `calc(${widthPercent}% - 0.5rem)`,
                                backgroundColor: 'hsl(var(--card))',
                                borderLeft: `3px solid ${color.dot}`
                              }}
                            >
                              <span className={cn('text-xs font-semibold', expanded ? 'whitespace-normal break-words' : 'truncate')}>
                                {e.title}
                              </span>
                              <span className={cn('mt-0.5 text-[10px] font-medium text-muted-foreground', expanded ? 'whitespace-normal break-words' : 'truncate')}>
                                {format(new Date(e.startAt), 'h:mm a')}
                              </span>
                            </div>
                          )}
                        </EventInteraction>
                      )}
                    />
                  );
                })}
              </div>
            ))}
            
            {/* Current Time Line across all resources */}
            {isToday(selectedDay) && (
              <div className="absolute left-0 right-0 h-px bg-red-500 z-20 pointer-events-none" style={{ top: `${calculateEventStyles(Date.now(), undefined, 0, 96).top}px` }}>
                <div className="absolute left-0 w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5 -mt-[2.5px]" />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <AppShell 
      mainClassName={FILL_MAIN_CLASS}
      pageTransitionClassName="flex-1 flex flex-col min-h-0"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-surface-1">
        
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <button 
              className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
              onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDay(new Date());
              }}
            >
              Today
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <span className="capitalize">{view}</span>
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuItem onClick={() => setView('month')}>
                  <CalendarIcon /> Month View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('day')}>
                  <AlignJustify /> Day Agenda
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('resource')}>
                  <Users /> Resource Grid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="ml-1 flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Previous date range">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Next date range">
                <ChevronRight />
              </Button>
            </div>
            
            <span className="ml-2 truncate text-[15px] font-semibold">
              {view === 'month' 
                ? format(currentMonth, 'MMMM yyyy')
                : format(selectedDay, 'EEEE, MMMM d, yyyy')
              }
            </span>
          </div>

          <div className="flex items-center gap-3">
             <ExternalCalendarSettingsDialog />
            <AddCalendarEntryDialog 
              trigger={
                <Button size="sm" leadingIcon={Plus}>
                  New booking
                </Button>
              }
            />
          </div>
        </div>

        <CalendarInviteStrip />

        {/* View Content */}
        {view === 'month' && renderMonthView()}
        {view === 'day' && renderDayView()}
        {view === 'resource' && renderResourceView()}

      </div>
    </AppShell>
  );
}

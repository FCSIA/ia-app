'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
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
import { ChevronLeft, ChevronRight, MapPin, Clock, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const calStart = startOfWeek(startOfMonth(currentMonth));
  const calEnd = endOfWeek(endOfMonth(currentMonth));
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const startDate = format(calStart, 'yyyy-MM-dd');
  const endDate = format(calEnd, 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => calendarApi.getEntries(startDate, endDate).then((r) => r.data),
  });

  const filteredEntries = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return [];
    
    return (entries as any[]).filter((e) => {
      const searchable = [
        e.title,
        e.description,
        e.location,
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchable.includes(query);
    });
  }, [entries, deferredSearch]);

  const isSearching = deferredSearch.trim() !== '';

  const getEventsForDay = (day: Date) =>
    (entries as any[]).filter((e) => isSameDay(new Date(e.startAt), day));

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const prevMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <div className="flex items-center gap-4 flex-1 max-w-md ml-8 mr-6">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 h-9 rounded-xl border-foreground/10"
                placeholder="Search events..."
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AddCalendarEntryDialog />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-xl">
                <ChevronLeft size={16} />
              </Button>
              <span className="font-semibold text-foreground w-36 text-center text-sm">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        {isSearching ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Search Results ({filteredEntries.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="text-xs">
                Back to Grid
              </Button>
            </div>
            {filteredEntries.length === 0 ? (
              <Card className="text-center py-16 border-dashed">
                <Search size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
                <p className="font-medium">No events match your search</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different title or location.</p>
                <Button variant="link" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
                  Clear search
                </Button>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredEntries.map((e: any) => (
                  <Card key={e.id} className="overflow-hidden border-foreground/10 hover:border-accent-500/30 transition-colors">
                    <CardContent className="p-4 flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex flex-col items-center justify-center shrink-0 border border-accent-500/20">
                        <span className="text-[10px] font-bold text-accent-600 uppercase">
                          {format(new Date(e.startAt), 'MMM')}
                        </span>
                        <span className="text-lg font-bold text-accent-700 leading-none">
                          {format(new Date(e.startAt), 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{e.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(e.startAt), 'h:mm a')}</span>
                          {e.location && <span className="flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
                        </div>
                        {e.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{e.description}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 border-b border-foreground/[0.07]">
                  {DAY_LABELS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-3 bg-foreground/[0.02]"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {days.map((day, i) => {
                    const dayEvents = getEventsForDay(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isSelected = !!selectedDay && isSameDay(day, selectedDay);
                    const isTodays = isToday(day);
                    const isLastRow = i >= days.length - 7;

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() =>
                          setSelectedDay(selectedDay && isSameDay(day, selectedDay) ? null : day)
                        }
                        className={[
                          'p-2 min-h-[88px] text-left transition-all duration-150 relative group',
                          !isCurrentMonth ? 'opacity-25' : 'hover:bg-foreground/[0.03]',
                          isSelected ? 'bg-accent-500/[0.06]' : '',
                          !isLastRow ? 'border-b border-foreground/[0.06]' : '',
                          i % 7 !== 6 ? 'border-r border-foreground/[0.06]' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {/* Selected ring overlay */}
                        {isSelected && (
                          <span className="absolute inset-0 ring-1 ring-inset ring-accent-500/40 rounded-none pointer-events-none" />
                        )}

                        {/* Date number */}
                        <span
                          className={[
                            'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all mb-1.5',
                            isTodays
                              ? 'text-white font-bold'
                              : isSelected
                              ? 'text-accent-500 dark:text-accent-400 font-semibold'
                              : 'text-foreground/80',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={
                            isTodays
                              ? {
                                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                                  boxShadow: '0 2px 10px rgba(249,115,22,0.4)',
                                }
                              : undefined
                          }
                        >
                          {format(day, 'd')}
                        </span>

                        {/* Event pills */}
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map((e: any) => (
                            <div
                              key={e.id}
                              className="text-[10px] rounded px-1.5 py-0.5 truncate font-medium"
                              style={{
                                background: 'rgba(249,115,22,0.12)',
                                color: '#f97316',
                              }}
                            >
                              {e.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-muted-foreground font-medium pl-0.5">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Selected day detail */}
        {selectedDay && (
          <Card>
            <CardHeader className="pb-3 border-b border-foreground/[0.07]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {format(selectedDay, 'EEEE, MMMM d')}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {selectedEvents.length === 0
                      ? 'No events'
                      : `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''}`}
                  </span>
                  <AddCalendarEntryDialog 
                    initialDate={selectedDay} 
                    trigger={
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-foreground/10 hover:bg-accent-500/10 hover:text-accent-600 transition-all">
                        <Plus size={14} />
                      </Button>
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {selectedEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">
                  Nothing scheduled for this day.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((e: any) => (
                    <div
                      key={e.id}
                      className="flex gap-4 p-4 rounded-xl relative overflow-hidden border border-foreground/[0.06]"
                      style={{ background: 'rgba(249,115,22,0.04)' }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                        style={{ background: 'linear-gradient(180deg, #f97316, #ea580c)' }}
                      />

                      <div className="flex-1 min-w-0 pl-1">
                        <p className="font-semibold text-foreground">{e.title}</p>
                        {e.description && (
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {e.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium"
                            style={{
                              background: 'rgba(249,115,22,0.1)',
                              color: '#f97316',
                            }}
                          >
                            <Clock size={11} />
                            {format(new Date(e.startAt), 'h:mm a')}
                            {e.endAt && ` – ${format(new Date(e.endAt), 'h:mm a')}`}
                          </span>
                          {e.location && (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium"
                              style={{
                                background: 'rgba(249,115,22,0.1)',
                                color: '#f97316',
                              }}
                            >
                              <MapPin size={11} />
                              {e.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, startOfWeek, endOfWeek, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => calendarApi.getEntries(startDate, endDate).then((r) => r.data),
  });

  const calStart = startOfWeek(startOfMonth(currentMonth));
  const calEnd = endOfWeek(endOfMonth(currentMonth));
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    (entries as any[]).filter((e) => isSameDay(new Date(e.startAt), day));

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="font-semibold text-foreground w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <Card className="p-0 overflow-hidden border">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-3 bg-muted/30">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const todayDay = isToday(day);
              const isLastRow = i >= days.length - 7;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(selectedDay && isSameDay(day, selectedDay) ? null : day)}
                  className={`p-2 min-h-[90px] text-left transition-all duration-150 relative group
                    ${!isCurrentMonth ? 'opacity-30 bg-muted/10' : 'hover:bg-muted/50'}
                    ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary' : ''}
                    ${!isLastRow ? 'border-b' : ''}
                    ${i % 7 !== 6 ? 'border-r' : ''}
                  `}
                >
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all mb-1
                    ${todayDay
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-foreground group-hover:bg-muted'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((e: any) => (
                      <div key={e.id} className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 truncate border border-primary/20 font-medium">{e.title}</div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground font-medium pl-1">+{dayEvents.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {selectedDay && (
          <Card className="mt-6">
            <CardHeader className="pb-3 border-b mb-3">
              <CardTitle className="text-lg">{format(selectedDay, 'EEEE, MMMM d')}</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No events on this day</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((e: any) => (
                    <div
                      key={e.id}
                      className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 relative overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-l-xl"></div>
                      <p className="font-semibold text-foreground">{e.title}</p>
                      {e.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{e.description}</p>}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5 bg-background border px-2 py-1 rounded-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          {format(new Date(e.startAt), 'h:mm a')}{e.endAt && ` – ${format(new Date(e.endAt), 'h:mm a')}`}
                        </span>
                        {e.location && (
                          <span className="flex items-center gap-1 bg-background border px-2 py-1 rounded-md">
                            <MapPin size={12} className="text-orange-500" />{e.location}
                          </span>
                        )}
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

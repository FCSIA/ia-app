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
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 rounded-xl hover:bg-white/[0.07] text-white/60 hover:text-white transition-all duration-200"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-white/90 w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 rounded-xl hover:bg-white/[0.07] text-white/60 hover:text-white transition-all duration-200"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-white/35 py-3">{d}</div>
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
                  className={`p-2 min-h-[80px] text-left transition-all duration-150 relative group
                    ${!isCurrentMonth ? 'opacity-25' : ''}
                    ${isSelected ? 'bg-accent-500/10' : 'hover:bg-white/[0.04]'}
                    ${!isLastRow ? 'border-b border-white/[0.05]' : ''}
                    ${i % 7 !== 6 ? 'border-r border-white/[0.05]' : ''}
                  `}
                >
                  {isSelected && (
                    <span className="absolute inset-0 border border-accent-500/30 pointer-events-none" />
                  )}
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all
                    ${todayDay
                      ? 'bg-accent-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                      : 'text-white/80 group-hover:scale-110'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e: any) => (
                      <div key={e.id} className="text-[10px] bg-accent-500/15 text-accent-400 rounded px-1 truncate border border-accent-500/20">{e.title}</div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-white/30">+{dayEvents.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div className="card mt-4">
            <h2 className="font-semibold text-white mb-3">{format(selectedDay, 'EEEE, MMMM d')}</h2>
            {selectedEvents.length === 0 ? (
              <p className="text-white/35 text-sm">No events on this day</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e: any) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-xl"
                    style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}
                  >
                    <p className="font-medium text-white/90">{e.title}</p>
                    {e.description && <p className="text-sm text-white/50 mt-0.5">{e.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/40">
                      <span>{format(new Date(e.startAt), 'h:mm a')}{e.endAt && ` – ${format(new Date(e.endAt), 'h:mm a')}`}</span>
                      {e.location && <span className="flex items-center gap-1"><MapPin size={10}/>{e.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
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
import { ChevronLeft, ChevronRight, Plus, Settings2, Calendar as CalendarIcon, AlignJustify, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddCalendarEntryDialog } from '@/components/calendar/AddCalendarEntryDialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export type CalendarSource = 'DISTRICT' | 'SCHOOL' | 'CLUB' | 'PERSONAL' | 'FLEX_FRIDAY';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_COLORS: Record<CalendarSource, { bg: string; text: string; dot: string; isMultiDay?: boolean }> = {
  PERSONAL: { bg: 'rgba(255,255,255,0.05)', text: '#ffffff', dot: '#a855f7' },
  SCHOOL:   { bg: 'rgba(255,255,255,0.05)', text: '#ffffff', dot: '#3b82f6' },
  DISTRICT: { bg: '#831843', text: '#fce7f3', dot: '#f43f5e', isMultiDay: true },
  CLUB:     { bg: 'rgba(255,255,255,0.05)', text: '#ffffff', dot: '#eab308' },
  FLEX_FRIDAY: { bg: 'rgba(255,255,255,0.05)', text: '#ffffff', dot: '#22c55e' },
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
  
  // Calculate relative to the view's start hour
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

export default function CalendarPage() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [view, setView] = useState<'month' | 'day' | 'resource'>('month');
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
      <AppShell>
        <div className="w-full h-[calc(100vh-2rem)] min-h-[600px] bg-[#121212] rounded-xl border border-white/10 overflow-hidden flex items-center justify-center text-white font-sans shadow-2xl">
          <div className="animate-pulse text-white/50 text-sm font-medium">Loading calendar...</div>
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
    <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden">
      {/* Day of week headers */}
      <div className="grid grid-cols-7 border-b border-white/10 shrink-0 bg-[#151515]">
        {DAY_LABELS.map((d) => (
          <div key={d} className="px-4 py-3 text-xs font-medium text-white/50">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
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
              className={`
                relative flex flex-col min-h-[120px] border-white/10 p-1.5 group cursor-pointer
                ${!isCurrentMonth ? 'bg-[#0a0a0a]/50 text-white/30' : 'hover:bg-white/[0.02]'}
                ${i % 7 !== 6 ? 'border-r' : ''}
                ${i < days.length - 7 ? 'border-b' : ''}
                ${isSelected ? 'bg-white/[0.04]' : ''}
              `}
            >
              <div className="flex-1 flex flex-col gap-1 overflow-hidden pt-1">
                {dayEvents.slice(0, 3).map((e: any) => {
                  const color = getSourceColor(e.source as CalendarSource);
                  if (color.isMultiDay) {
                    return (
                      <div key={e._id} className="relative z-10 mx-0.5 px-2 py-1 rounded text-xs font-medium truncate shadow-sm border border-black/10" style={{ backgroundColor: color.bg, color: color.text }}>
                        {e.title}
                      </div>
                    );
                  }
                  return (
                    <div key={e._id} className="flex items-center gap-1.5 mx-0.5 px-2 py-1 rounded border border-white/[0.08] bg-[#1a1a1a] text-xs font-medium text-white/90 shadow-sm transition-colors hover:bg-[#222]">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.dot }} />
                      <span className="truncate flex-1">{e.title}</span>
                      <span className="text-white/40 text-[10px] whitespace-nowrap">{format(new Date(e.startAt), 'h:mm a')}</span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="mx-1 mt-0.5 text-[10px] text-white/40 font-medium hover:text-white/60 transition-colors">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 right-2 flex items-center justify-center">
                <span
                  className={`
                    text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors
                    ${isTodays ? 'bg-white text-black' : isCurrentMonth ? 'text-white/70 group-hover:text-white' : 'text-white/30'}
                  `}
                >
                  {format(day, 'd')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDayView = () => {
    // Generate hours from 12 AM to 11 PM
    const hours = Array.from({ length: 24 }, (_, i) => i); 
    const dayEvents = getEventsForDay(selectedDay);

    return (
      <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden">
        {/* Day Header */}
        <div className="flex border-b border-white/10 shrink-0 bg-[#151515]">
          <div className="w-16 border-r border-white/10 shrink-0" />
          <div className="flex-1 px-4 py-3 text-sm font-medium text-white/80">
            {format(selectedDay, 'EEE d')}
          </div>
        </div>
        
        {/* All Day Section */}
        <div className="flex border-b border-white/10 shrink-0 bg-[#151515]">
          <div className="w-16 border-r border-white/10 shrink-0 flex items-center justify-center text-xs text-white/40 py-2">
            All day
          </div>
          <div className="flex-1 p-1">
            {/* Mock an all day event or multi day event here if needed */}
          </div>
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="flex min-h-[800px]">
            {/* Time labels */}
            <div className="w-16 border-r border-white/10 shrink-0 relative bg-[#111]">
              {hours.map((hour) => (
                <div key={hour} className="h-20 relative border-b border-white/[0.05]">
                  <span className="absolute -top-2.5 right-2 text-[10px] font-medium text-white/40">
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid lines and events */}
            <div className="flex-1 relative">
              {hours.map((hour) => (
                <div key={hour} className="h-20 border-b border-white/[0.05]" />
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
                  <div 
                    key={e._id} 
                    className="absolute rounded-md overflow-hidden border border-black/20 shadow-md p-2 flex flex-col"
                    style={{ 
                      top: `${top}px`, 
                      height: `${height}px`, 
                      left: `calc(0.5rem + ${leftPercent}%)`,
                      width: `calc(${widthPercent}% - 1.5rem)`,
                      backgroundColor: color.bg 
                    }}
                  >
                    {/* The left border color block shown in the screenshot */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color.dot }} />
                    <div className="pl-2 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                        {e.title.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-white/90 truncate">{e.title}</span>
                    </div>
                    <span className="pl-9 mt-0.5 text-xs font-medium text-white/60 truncate">
                      {e.location && `${e.location} • `}{format(new Date(e.startAt), 'h:mm a')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResourceView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0 to 23
    const dayEvents = getEventsForDay(selectedDay);

    return (
      <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden">
        {/* Resource Headers */}
        <div className="flex border-b border-white/10 shrink-0 bg-[#151515]">
          <div className="w-16 border-r border-white/10 shrink-0" />
          {MOCK_RESOURCES.map((r) => (
            <div key={r.id} className="flex-1 border-r border-white/10 text-center py-3 text-sm font-medium text-white/80">
              {r.name}
            </div>
          ))}
        </div>

        {/* All Day Section */}
        <div className="flex border-b border-white/10 shrink-0 bg-[#151515]">
          <div className="w-16 border-r border-white/10 shrink-0 flex items-center justify-center text-xs text-white/40 py-2">
            All day
          </div>
          {MOCK_RESOURCES.map((r) => (
            <div key={r.id} className="flex-1 border-r border-white/10" />
          ))}
        </div>

        {/* Time Grid & Resources */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="flex min-h-[800px]">
            {/* Time labels */}
            <div className="w-16 border-r border-white/10 shrink-0 relative bg-[#111]">
              {hours.map((hour) => (
                <div key={hour} className="h-24 relative border-b border-white/[0.05]">
                  <span className="absolute -top-2.5 right-2 text-[10px] font-medium text-white/40">
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Resource Columns */}
            {MOCK_RESOURCES.map((r, colIndex) => (
              <div key={r.id} className="flex-1 border-r border-white/10 relative">
                {hours.map((hour) => (
                  <div key={hour} className="h-24 border-b border-white/[0.05]" />
                ))}

                {/* Event Blocks */}
                {processOverlaps(dayEvents.filter((e: any) => {
                  const matchedResource = matchResource(e.location, MOCK_RESOURCES);
                  return matchedResource ? matchedResource.id === r.id : colIndex === 0;
                })).map(({ event: e, leftPercent, widthPercent }: any) => {
                  const { top, height } = calculateEventStyles(e.startAt, e.endAt, 0, 96);
                  const color = getSourceColor(e.source as CalendarSource);
                  
                  return (
                    <div 
                      key={e._id} 
                      className="absolute rounded-sm overflow-hidden flex flex-col p-2 border border-black/20"
                      style={{ 
                        top: `${top}px`, 
                        height: `${height}px`, 
                        left: `calc(0.25rem + ${leftPercent}%)`,
                        width: `calc(${widthPercent}% - 0.5rem)`,
                        backgroundColor: '#1e293b',
                        borderLeft: `3px solid ${color.dot}`
                      }}
                    >
                      <span className="text-xs font-semibold text-white/90 truncate">
                        {e.title}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium text-white/50 truncate">
                        {format(new Date(e.startAt), 'h:mm a')}
                      </span>
                    </div>
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
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="w-full h-[calc(100vh-2rem)] min-h-[600px] bg-[#121212] rounded-xl border border-white/10 overflow-hidden flex flex-col text-white font-sans shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="text-sm font-medium hover:text-white/80 transition-colors" 
              onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDay(new Date());
              }}
            >
              Today
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm font-medium cursor-pointer hover:bg-white/5 py-1 px-2 rounded-md transition-colors border border-transparent hover:border-white/10">
                  <span className="capitalize">{view}</span> <span className="text-[10px] opacity-60">▼</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40 bg-[#1a1a1a] border-white/10 text-white">
                <DropdownMenuItem onClick={() => setView('month')} className="hover:bg-white/10 focus:bg-white/10">
                  <CalendarIcon className="mr-2 h-4 w-4" /> Month View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('day')} className="hover:bg-white/10 focus:bg-white/10">
                  <AlignJustify className="mr-2 h-4 w-4" /> Day Agenda
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('resource')} className="hover:bg-white/10 focus:bg-white/10">
                  <Users className="mr-2 h-4 w-4" /> Resource Grid
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="flex items-center gap-0.5 ml-1">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-md hover:bg-white/10 text-white">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-md hover:bg-white/10 text-white">
                <ChevronRight size={16} />
              </Button>
            </div>
            
            <span className="text-[15px] font-semibold ml-2">
              {view === 'month' 
                ? format(currentMonth, 'MMMM yyyy')
                : format(selectedDay, 'EEEE, MMMM d, yyyy')
              }
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="tertiary" 
              className="h-8 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white rounded-md text-xs font-medium px-3"
              onClick={() => toast({ title: 'Calendar Settings', description: 'Calendar settings are coming soon!' })}
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Settings
            </Button>
            <AddCalendarEntryDialog 
              trigger={
                <Button className="h-8 bg-white text-black hover:bg-white/90 rounded-md text-xs font-medium px-3 shadow-sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New booking
                </Button>
              }
            />
          </div>
        </div>

        {/* View Content */}
        {view === 'month' && renderMonthView()}
        {view === 'day' && renderDayView()}
        {view === 'resource' && renderResourceView()}

      </div>
    </AppShell>
  );
}

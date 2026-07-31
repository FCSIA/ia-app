'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ScheduleDayEditor } from '@/components/schedule/schedule-day-editor';
import { ResolvedDayPanel } from '@/components/schedule/resolved-day-panel';
import { WEEKDAYS, getWeekdayForDate } from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';
import { TabPanel } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function MySchedulePanel() {
  const {
    blocks,
    courses,
    currentStatus,
    data,
    lunchPeriod,
    scheduleEntries,
    selectedDateKey,
    selectedWeekday,
    setSelectedWeekday,
    setSelectedDateKey,
    setLunchPeriod,
    updateScheduleEntry,
    user,
  } = useScheduleWorkspace();

  const todayWeekday = getWeekdayForDate(new Date());

  return (
    <TabPanel value="my" className="mt-5 space-y-6">
      {data?.resolvedDay ? (
        <ResolvedDayPanel
          day={data.resolvedDay}
          entries={scheduleEntries}
          lunchPeriod={lunchPeriod}
          selectedDateKey={selectedDateKey}
          onDateChange={setSelectedDateKey}
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 md:hidden">
        <span className="text-xs font-medium text-muted-foreground">Lunch period</span>
        <ToggleGroup
          type="single"
          value={lunchPeriod ?? ''}
          onValueChange={(value) => {
            if (value === 'PERIOD_4' || value === 'PERIOD_5') setLunchPeriod(value);
          }}
          variant="outline"
          size="sm"
          aria-label="Lunch period"
        >
          <ToggleGroupItem value="PERIOD_4" className="h-8 px-3 text-xs">Period 4</ToggleGroupItem>
          <ToggleGroupItem value="PERIOD_5" className="h-8 px-3 text-xs">Period 5</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <section>
      <div className="flex items-center gap-1 border-b border-border/30">
        {WEEKDAYS.map((day) => {
          const isToday = day.value === todayWeekday;
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => setSelectedWeekday(day.value)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5',
                selectedWeekday === day.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{day.shortLabel}</span>
              {isToday && (
                <span className="size-1.5 rounded-full bg-primary" title="Today" />
              )}
            </button>
          );
        })}
        <div className="mb-1 ml-auto hidden items-center gap-2 md:flex">
          <span className="text-xs text-muted-foreground">Lunch</span>
          <ToggleGroup
            type="single"
            value={lunchPeriod ?? ''}
            onValueChange={(value) => {
              if (value === 'PERIOD_4' || value === 'PERIOD_5') setLunchPeriod(value);
            }}
            variant="outline"
            size="sm"
            aria-label="Lunch period"
          >
            <ToggleGroupItem value="PERIOD_4" className="h-7 px-2 text-xs">P4</ToggleGroupItem>
            <ToggleGroupItem value="PERIOD_5" className="h-7 px-2 text-xs">P5</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Link href="/courses" className="mb-1 ml-1">
          <Button variant="secondary" size="sm" className="h-7 text-xs">
            <BookOpen className="mr-1.5 size-3" />
            Catalog
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <ScheduleDayEditor
          weekday={selectedWeekday}
          blocks={blocks}
          entries={scheduleEntries}
          courses={courses}
          preferredGradeLevel={user?.gradeLevel ?? undefined}
          onChange={updateScheduleEntry}
          currentStatus={currentStatus}
          lunchPeriod={lunchPeriod}
        />
      </div>
      </section>
    </TabPanel>
  );
}

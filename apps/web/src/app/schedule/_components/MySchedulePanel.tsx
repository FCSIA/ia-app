'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ScheduleDayEditor } from '@/components/schedule/schedule-day-editor';
import { WEEKDAYS, getWeekdayForDate } from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function MySchedulePanel() {
  const {
    blocks,
    courses,
    currentStatus,
    scheduleEntries,
    selectedWeekday,
    setSelectedWeekday,
    updateScheduleEntry,
    user,
  } = useScheduleWorkspace();

  const todayWeekday = getWeekdayForDate(new Date());

  return (
    <TabPanel value="my" className="mt-6">
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
        <Link href="/courses" className="mb-1 ml-auto">
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
        />
      </div>
    </TabPanel>
  );
}


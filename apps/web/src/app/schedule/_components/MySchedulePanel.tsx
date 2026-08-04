'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ScheduleDayEditor } from '@/components/schedule/schedule-day-editor';
import { ScheduleImportDialog } from '@/components/schedule/schedule-import-dialog';
import { WEEKDAYS, getWeekdayForDate } from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function MySchedulePanel() {
  const {
    applyImportedSchedule,
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
        <div className="mb-1 ml-auto flex items-center gap-1">
          <ScheduleImportDialog courses={courses} onApply={applyImportedSchedule} />
          <Button asChild variant="secondary" size="sm">
            <Link href="/courses">
              <BookOpen data-icon="inline-start" />
              Catalog
            </Link>
          </Button>
        </div>
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


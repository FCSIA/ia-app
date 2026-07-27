'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ScheduleDayEditor } from '@/components/schedule/schedule-day-editor';
import { WEEKDAYS } from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function MySchedulePanel() {
  const {
    blocks,
    courses,
    scheduleEntries,
    selectedWeekday,
    setSelectedWeekday,
    updateScheduleEntry,
    user,
  } = useScheduleWorkspace();

  return (
    <TabPanel value="my" className="mt-6">
      <div className="flex items-center gap-1 border-b border-border/30">
        {WEEKDAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => setSelectedWeekday(day.value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              selectedWeekday === day.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {day.shortLabel}
          </button>
        ))}
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
        />
      </div>
    </TabPanel>
  );
}

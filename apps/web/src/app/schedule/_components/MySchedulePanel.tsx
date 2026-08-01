"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ScheduleDayEditor } from "@/components/schedule/schedule-day-editor";
import { ResolvedDayPanel } from "@/components/schedule/resolved-day-panel";
import {
  WEEKDAYS,
  getWeekdayForDate,
} from "@/components/schedule/schedule-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabItem, TabPanel, Tabs, TabsList } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";

export function MySchedulePanel() {
  const {
    blocks,
    courses,
    currentStatus,
    data,
    lunchPeriod,
    scheduleEntries,
    selectedDateKey,
    setSelectedDateKey,
    setLunchPeriod,
    updateScheduleEntry,
    user,
  } = useScheduleWorkspace();

  const todayWeekday = getWeekdayForDate(new Date());
  const [selectedWeekday, setSelectedWeekday] = useState(
    () => todayWeekday ?? "MONDAY",
  );
  const selectedDay = WEEKDAYS.find((day) => day.value === selectedWeekday);

  return (
    <TabPanel value="my" className="mt-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.7fr)] xl:items-start">
        {data?.resolvedDay ? (
          <div className="xl:sticky xl:top-4">
            <ResolvedDayPanel
              day={data.resolvedDay}
              entries={scheduleEntries}
              lunchPeriod={lunchPeriod}
              selectedDateKey={selectedDateKey}
              onDateChange={setSelectedDateKey}
            />
          </div>
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
          <header className="flex flex-col gap-4 bg-surface-3 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {selectedDay?.label ?? "School day"}
                  </h2>
                  {selectedWeekday === todayWeekday ? (
                    <Badge size="sm" variant="dot" color="blue">
                      Today
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose the class assigned to each canonical period.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Lunch
                </span>
                <ToggleGroup
                  type="single"
                  value={lunchPeriod ?? ""}
                  onValueChange={(value) => {
                    if (value === "PERIOD_4" || value === "PERIOD_5")
                      setLunchPeriod(value);
                  }}
                  variant="outline"
                  size="sm"
                  aria-label="Lunch period"
                >
                  <ToggleGroupItem value="PERIOD_4">Period 4</ToggleGroupItem>
                  <ToggleGroupItem value="PERIOD_5">Period 5</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 overflow-x-auto pb-1 sm:pb-0">
                <Tabs
                  value={selectedWeekday}
                  onValueChange={(value) => {
                    if (WEEKDAYS.some((day) => day.value === value)) {
                      setSelectedWeekday(value as typeof selectedWeekday);
                    }
                  }}
                >
                  <TabsList className="w-max">
                    {WEEKDAYS.map((day) => (
                      <TabItem
                        key={day.value}
                        value={day.value}
                        label={day.shortLabel}
                      />
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/courses">
                  <BookOpen data-icon="inline-start" />
                  Course catalog
                </Link>
              </Button>
            </div>
          </header>

          <div className="p-3 sm:p-5">
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
      </div>
    </TabPanel>
  );
}

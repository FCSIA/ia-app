"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ScheduleDayEditor } from "@/components/schedule/schedule-day-editor";
import { ScheduleImportDialog } from "@/components/schedule/schedule-import-dialog";
import { ResolvedDayPanel } from "@/components/schedule/resolved-day-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabPanel } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";

export function MySchedulePanel() {
  const {
    applyImportedSchedule,
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

  const selectedWeekday = data?.resolvedDay.weekday;

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
                    {data?.resolvedDay.name ?? "School day"}
                  </h2>
                  {selectedDateKey === new Date().toISOString().slice(0, 10) ? (
                    <Badge size="sm" variant="solid" color="blue">
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
                  className="rounded-lg bg-muted p-0.5"
                  size="sm"
                  aria-label="Lunch period"
                >
                  <ToggleGroupItem
                    value="PERIOD_4"
                    className="h-7 min-w-0 px-2.5 text-xs shadow-none"
                  >
                    Period 4
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="PERIOD_5"
                    className="h-7 min-w-0 px-2.5 text-xs shadow-none"
                  >
                    Period 5
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Editing the classes used by this calendar date’s canonical periods.
              </p>
              <div className="flex items-center gap-2">
                <ScheduleImportDialog
                  courses={courses}
                  onApply={applyImportedSchedule}
                />
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  leadingIcon={BookOpen}
                >
                  <Link href="/courses">Course catalog</Link>
                </Button>
              </div>
            </div>
          </header>

          <div className="p-3 sm:p-5">
            {selectedWeekday ? (
              <ScheduleDayEditor
                weekday={selectedWeekday}
                blocks={blocks}
                planBlocks={data?.resolvedDay.blocks}
                entries={scheduleEntries}
                courses={courses}
                preferredGradeLevel={user?.gradeLevel ?? undefined}
                onChange={updateScheduleEntry}
                currentStatus={currentStatus}
                lunchPeriod={lunchPeriod}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                This date has no editable school schedule.
              </p>
            )}
          </div>
        </section>
      </div>
    </TabPanel>
  );
}

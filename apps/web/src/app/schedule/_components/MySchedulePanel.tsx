"use client";

import Link from "next/link";
import { BookOpen, Pencil, Utensils } from "lucide-react";
import { useState } from "react";
import { ScheduleDayEditor } from "@/components/schedule/schedule-day-editor";
import { ScheduleImportDialog } from "@/components/schedule/schedule-import-dialog";
import { ResolvedDayPanel } from "@/components/schedule/resolved-day-panel";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
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
  const [isEditing, setIsEditing] = useState(false);
  const [lunchOpen, setLunchOpen] = useState(false);

  if (!isEditing) {
    return (
      <section aria-label="My schedule">
        <section className={`max-w-2xl rounded-2xl border border-border bg-card p-4 ${CARD_SURFACE_FOREGROUND}`}>
          <header className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">My schedule</h2>
            <Button
              size="sm"
              variant="tertiary"
              leadingIcon={Pencil}
              onClick={() => setIsEditing(true)}
            >
              Edit schedule
            </Button>
          </header>
          {data?.resolvedDay ? (
            <ResolvedDayPanel
              day={data.resolvedDay}
              entries={scheduleEntries}
              lunchPeriod={lunchPeriod}
              selectedDateKey={selectedDateKey}
              onDateChange={setSelectedDateKey}
            />
          ) : null}
        </section>
      </section>
    );
  }

  return (
    <section aria-label="My schedule">
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

        <section className="min-w-0">
          <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 pb-3">
            <h2 className="text-base font-semibold text-foreground">Classes</h2>
            <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Done
              </Button>
              <Popover open={lunchOpen} onOpenChange={setLunchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={Utensils}
                    active={lunchOpen}
                  >
                    Edit Lunch
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-44 p-1.5">
                  <RadioGroup
                    value={lunchPeriod ?? ""}
                    onValueChange={(value) => {
                      if (value === "PERIOD_4" || value === "PERIOD_5") {
                        setLunchPeriod(value);
                        setLunchOpen(false);
                      }
                    }}
                    className="w-full"
                    aria-label="Lunch period"
                  >
                    <RadioItem
                      value="PERIOD_4"
                      label="Period 4"
                      index={0}
                      className="w-full"
                    />
                    <RadioItem
                      value="PERIOD_5"
                      label="Period 5"
                      index={1}
                      className="w-full"
                    />
                  </RadioGroup>
                </PopoverContent>
              </Popover>
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
          </header>

          <div className="pt-3">
            {selectedWeekday ? (
              <ScheduleDayEditor
                weekday={selectedWeekday}
                blocks={blocks}
                planBlocks={
                  data?.resolvedDay.calendarSetupRequired
                    ? undefined
                    : data?.resolvedDay.blocks
                }
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
    </section>
  );
}

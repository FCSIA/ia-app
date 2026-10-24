"use client";

import { DatePicker } from "@/components/ui/date-picker";

/**
 * The schedule's school-day picker is the shared DatePicker (same trigger,
 * popover and day grid as every other date field), labelled with the long
 * weekday because the day name decides which schedule applies.
 */
export function ScheduleDatePicker({
  dateKey,
  onDateChange,
  id,
  className,
}: {
  dateKey: string;
  onDateChange: (dateKey: string) => void;
  id?: string;
  className?: string;
}) {
  return (
    <DatePicker
      id={id}
      value={dateKey}
      onChange={(next) => {
        if (next) onDateChange(next);
      }}
      labelFormat="EEEE, MMMM d"
      className={className}
    />
  );
}

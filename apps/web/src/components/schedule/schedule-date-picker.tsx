"use client";

import { DateField } from "@/components/forms/date-field";

/** The shared school-day field uses Fluid's weekday-aware date label. */
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
    <DateField
      aria-label="Schedule date"
      id={id}
      value={dateKey}
      onChange={(next) => {
        if (next) onDateChange(next);
      }}
      className={className}
    />
  );
}

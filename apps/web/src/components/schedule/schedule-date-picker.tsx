"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey
    .split("-")
    .map((segment) => Number.parseInt(segment, 10));
  return new Date(year, month - 1, day, 12);
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(dateKey: string) {
  return DATE_LABEL_FORMATTER.format(new Date(`${dateKey}T12:00:00.000Z`));
}

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
  const [open, setOpen] = useState(false);
  const selectedDate = dateFromKey(dateKey);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="tertiary"
          size="md"
          className={cn("min-w-0 justify-start", className)}
          leadingIcon={CalendarDays}
        >
          {dateLabel(dateKey)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onDateChange(dateKeyFromDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

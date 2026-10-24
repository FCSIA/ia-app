'use client';

import { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Trigger id, for an external `<label htmlFor>`. */
  id?: string;
  /** Layout classes for the picker row (e.g. flex-1 inside a toolbar). */
  className?: string;
  /** date-fns pattern for the trigger label; one compact default app-wide. */
  labelFormat?: string;
  buttonClassName?: string;
  disabled?: boolean;
  disabledDays?: Matcher | Matcher[];
  allowClear?: boolean;
  startMonth?: Date;
  endMonth?: Date;
};

function parseDateValue(value?: string | null) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  id,
  className,
  labelFormat = 'MMM d, yyyy',
  buttonClassName,
  disabled = false,
  disabledDays,
  allowClear = false,
  startMonth,
  endMonth,
}: DatePickerProps) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="tertiary"
            leadingIcon={CalendarDays}
            disabled={disabled}
            className={cn(
              'min-w-0 w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
              buttonClassName,
            )}
          >
            {/* The label owns truncation: Button centres its content, so an
                unwrapped label wider than the trigger clips at both ends. */}
            <span className="min-w-0 truncate">
              {selectedDate ? format(selectedDate, labelFormat) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selectedDate}
            selected={selectedDate}
            // Without a clear control, re-clicking the chosen day must not
            // silently empty the field; clearing is the X button's job.
            required={!allowClear}
            onSelect={(date: Date | undefined) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '');
              if (date) setOpen(false);
            }}
            disabled={disabledDays}
            startMonth={startMonth}
            endMonth={endMonth}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {allowClear && value ? (
        <Button
          type="button"
          variant="tertiary"
          size="icon"
          className="shrink-0"
          onClick={() => onChange('')}
        >
          <X className="size-4" />
          <span className="sr-only">Clear date</span>
        </Button>
      ) : null}
    </div>
  );
}

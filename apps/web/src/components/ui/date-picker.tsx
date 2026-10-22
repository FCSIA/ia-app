'use client';

import { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
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
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="tertiary"
            leadingIcon={CalendarIcon}
            disabled={disabled}
            className={cn(
              'min-w-0 w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
              buttonClassName,
            )}
          >
            {selectedDate ? format(selectedDate, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selectedDate}
            selected={selectedDate}
            onSelect={(date) => {
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

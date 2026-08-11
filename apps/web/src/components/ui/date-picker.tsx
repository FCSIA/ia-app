'use client';

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
  const anchorYear = (selectedDate ?? new Date()).getFullYear();
  const navigationStartMonth = startMonth ?? new Date(anchorYear - 1, 0, 1);
  const navigationEndMonth = endMonth ?? new Date(anchorYear + 2, 11, 1);

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="tertiary"
            leadingIcon={CalendarIcon}
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
              buttonClassName,
            )}
          >
            {selectedDate ? format(selectedDate, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[19rem] p-0" align="start">
          <Calendar
            className="w-full"
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
            disabled={disabledDays}
            navLayout="around"
            startMonth={navigationStartMonth}
            endMonth={navigationEndMonth}
            initialFocus
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

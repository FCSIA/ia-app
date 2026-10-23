'use client';

import { useId } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarClock, X } from 'lucide-react';
import type { Matcher } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DateTimePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  buttonClassName?: string;
  disabled?: boolean;
  disabledDays?: Matcher | Matcher[];
  allowClear?: boolean;
  defaultTime?: string;
};

function parseDateTimeValue(value?: string | null) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function combineDateAndTime(date: Date, time: string) {
  return `${format(date, 'yyyy-MM-dd')}T${time}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick a date and time',
  buttonClassName,
  disabled = false,
  disabledDays,
  allowClear = false,
  defaultTime = '08:00',
}: DateTimePickerProps) {
  const timeInputId = useId();
  const selectedDateTime = parseDateTimeValue(value);
  const selectedDate = selectedDateTime
    ? new Date(
        selectedDateTime.getFullYear(),
        selectedDateTime.getMonth(),
        selectedDateTime.getDate(),
      )
    : undefined;
  const timeValue = selectedDateTime ? format(selectedDateTime, 'HH:mm') : defaultTime;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="tertiary"
            leadingIcon={CalendarClock}
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDateTime && 'text-muted-foreground',
              buttonClassName,
            )}
          >
            {/* The label owns truncation (Button centres its content), and the
                compact date keeps the time visible in narrow form columns. */}
            <span className="min-w-0 truncate">
              {selectedDateTime
                ? format(selectedDateTime, 'MMM d, yyyy · h:mm a')
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selectedDate}
            selected={selectedDate}
            // Re-clicking the chosen day must not clear a required value.
            required={!allowClear}
            onSelect={(date: Date | undefined) => {
              if (!date) {
                onChange('');
                return;
              }
              onChange(combineDateAndTime(date, timeValue));
            }}
            disabled={disabledDays}
            autoFocus
          />
          <div className="space-y-2 border-t p-3">
            <Label htmlFor={timeInputId} className="text-xs font-medium text-muted-foreground">
              Time
            </Label>
            <Input
              id={timeInputId}
              type="time"
              value={timeValue}
              disabled={!selectedDate}
              onChange={(event) => {
                if (!selectedDate) return;
                onChange(combineDateAndTime(selectedDate, event.target.value || defaultTime));
              }}
            />
          </div>
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
          <span className="sr-only">Clear date and time</span>
        </Button>
      ) : null}
    </div>
  );
}

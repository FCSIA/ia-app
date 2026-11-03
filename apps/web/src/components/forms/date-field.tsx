'use client';

import { format, isValid, parseISO } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import type { Matcher } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

/** Converts the app's local ISO date fields at the primitive boundary. */
export function parseDateField(value?: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export type DateFieldProps = {
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disabledDays?: Matcher | Matcher[];
  allowClear?: boolean;
  startMonth?: Date;
  endMonth?: Date;
};

export function DateField({
  value, onChange, id, 'aria-label': ariaLabel, placeholder, className,
  disabled, disabledDays, allowClear = false, startMonth, endMonth,
}: DateFieldProps) {
  return (
    <DatePicker
      value={parseDateField(value)}
      onValueChange={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={cn('w-full', className)}
      disabled={disabled}
      clearable={allowClear}
      calendarProps={{ disabled: disabledDays, startMonth, endMonth }}
    />
  );
}

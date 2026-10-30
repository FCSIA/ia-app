'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { parseDateField, type DateFieldProps } from './date-field';
import { cn } from '@/lib/utils';

/** Local ISO serialization only; Fluid owns both date and time interactions. */
export function DateTimeField({
  value, onChange, id, 'aria-label': ariaLabel, placeholder = 'Pick a date',
  className, disabled, disabledDays, allowClear = false, defaultTime = '08:00',
}: Omit<DateFieldProps, 'startMonth' | 'endMonth'> & { defaultTime?: string }) {
  const selected = parseDateField(value);
  // A time can be drafted before choosing a date. The committed value remains
  // the form's source of truth once both parts are present.
  const [draftTime, setDraftTime] = useState(defaultTime);
  const time = selected ? format(selected, 'HH:mm') : draftTime;

  return (
    <DatePicker
      value={selected}
      onValueChange={(date) => onChange(date ? `${format(date, 'yyyy-MM-dd')}T${time}` : '')}
      time={time}
      onTimeChange={(next) => {
        setDraftTime(next ?? defaultTime);
        if (selected) {
          onChange(next || !allowClear
            ? `${format(selected, 'yyyy-MM-dd')}T${next ?? defaultTime}`
            : '');
        }
      }}
      id={id}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={cn('w-full', className)}
      disabled={disabled}
      clearable={allowClear}
      calendarProps={{ disabled: disabledDays }}
    />
  );
}

'use client';

import { useId, type ReactNode } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { calendarDate, calendarInputDate } from './calendar-date';

export type ReminderValues = {
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
};

export function reminderValues(entry?: {
  title?: string;
  description?: string;
  location?: string;
  startAt: number;
  endAt?: number;
  allDay?: boolean;
}): ReminderValues {
  const start = calendarDate(entry?.startAt);
  if (!entry) start.setHours(8, 0, 0, 0);
  const allDay = entry?.allDay ?? false;
  const end = entry?.endAt
    ? calendarDate(entry.endAt)
    : allDay
      ? addDays(start, 1)
      : calendarDate(start.getTime() + 60 * 60 * 1000);
  return {
    title: entry?.title ?? '',
    description: entry?.description ?? '',
    location: entry?.location ?? '',
    start: format(start, "yyyy-MM-dd'T'HH:mm"),
    // The visible last day is inclusive; the stored all-day end is exclusive.
    end: format(allDay ? addDays(end, -1) : end, "yyyy-MM-dd'T'HH:mm"),
    allDay,
  };
}

export function reminderPayload(values: ReminderValues) {
  const start = calendarInputDate(values.start);
  const end = calendarInputDate(values.end);
  const startAt = values.allDay ? startOfDay(start).getTime() : start.getTime();
  const endAt = values.allDay
    ? addDays(startOfDay(end), 1).getTime()
    : end.getTime();
  if (
    !Number.isFinite(startAt) ||
    !Number.isFinite(endAt) ||
    endAt <= startAt
  ) {
    throw new Error('Choose an end after the start.');
  }
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    location: values.location.trim() || undefined,
    startAt,
    endAt,
    allDay: values.allDay,
  };
}

export function ReminderForm({
  values,
  onChange,
  disabled,
  children,
}: {
  values: ReminderValues;
  onChange: (values: ReminderValues) => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  const set = <K extends keyof ReminderValues>(
    key: K,
    value: ReminderValues[K],
  ) => onChange({ ...values, [key]: value });
  const changeAllDay = (allDay: boolean) => {
    const start = calendarInputDate(values.start);
    const end = calendarInputDate(values.end);
    if (!allDay && end <= start) end.setTime(start.getTime() + 60 * 60 * 1000);
    onChange({ ...values, allDay, end: format(end, "yyyy-MM-dd'T'HH:mm") });
  };
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Assignment due, study session…"
          maxLength={160}
          required
          disabled={disabled}
        />
      </Field>
      <Switch
        label="All day"
        checked={values.allDay}
        onCheckedChange={changeAllDay}
        disabled={disabled}
      />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field aria-labelledby={`${id}-start`}>
          <FieldLabel id={`${id}-start`}>Starts</FieldLabel>
          {values.allDay ? (
            <DatePicker
              value={values.start.slice(0, 10)}
              disabled={disabled}
              onChange={(date) => set('start', `${date}T00:00`)}
            />
          ) : (
            <DateTimePicker
              value={values.start}
              disabled={disabled}
              onChange={(value) => set('start', value)}
            />
          )}
        </Field>
        <Field aria-labelledby={`${id}-end`}>
          <FieldLabel id={`${id}-end`}>
            {values.allDay ? 'Last day' : 'Ends'}
          </FieldLabel>
          {values.allDay ? (
            <DatePicker
              value={values.end.slice(0, 10)}
              disabled={disabled}
              onChange={(date) => set('end', `${date}T00:00`)}
            />
          ) : (
            <DateTimePicker
              value={values.end}
              disabled={disabled}
              onChange={(value) => set('end', value)}
            />
          )}
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
        <Input
          id={`${id}-location`}
          value={values.location}
          onChange={(e) => set('location', e.target.value)}
          disabled={disabled}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>Details</FieldLabel>
        <Textarea
          id={`${id}-description`}
          value={values.description}
          maxLength={2000}
          onChange={(e) => set('description', e.target.value)}
          disabled={disabled}
        />
      </Field>
      {children}
    </FieldGroup>
  );
}

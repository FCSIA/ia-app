'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { calendarDate } from './calendar-date';
import { Plus } from 'lucide-react';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReminderForm, reminderPayload, reminderValues } from './reminder-form';

interface AddCalendarEntryDialogProps {
  initialDate?: Date;
  durationMinutes?: number;
  allDay?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AddCalendarEntryDialog({
  initialDate,
  durationMinutes = 60,
  allDay = false,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: AddCalendarEntryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const initial = useMemo(
    () =>
      initialDate
        ? reminderValues({
            startAt: initialDate.getTime(),
            endAt: allDay
              ? addDays(startOfDay(calendarDate(initialDate)), 1).getTime()
              : initialDate.getTime() + durationMinutes * 60_000,
            allDay,
          })
        : reminderValues(),
    [initialDate, durationMinutes, allDay],
  );
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const create = useMutation(api.events.calendar.create);
  const { toast } = useToast();
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(undefined);
    }
  }, [open, initial]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await create({ ...reminderPayload(form), source: 'PERSONAL' });
      setOpen(false);
      toast({ title: 'Reminder added to your calendar' });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the reminder.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? <Button leadingIcon={Plus}>Reminder</Button>}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New reminder</DialogTitle>
          <DialogDescription>
            Add a private reminder to your calendar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <ReminderForm values={form} onChange={setForm} disabled={pending} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save reminder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

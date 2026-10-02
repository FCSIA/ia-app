'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Clock, MapPin, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';

interface AddCalendarEntryDialogProps {
  initialDate?: Date;
  durationMinutes?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

function initialForm(initialDate?: Date) {
  return {
    title: '',
    description: '',
    location: '',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: initialDate ? format(initialDate, 'HH:mm') : '08:00',
  };
}

export function AddCalendarEntryDialog({
  initialDate,
  durationMinutes,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: AddCalendarEntryDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const { toast } = useToast();

  const [form, setForm] = useState(() => initialForm(initialDate));

  const createEntry = useMutation(api.events.calendar.create);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setForm(initialForm(initialDate));
  }, [initialDate, open]);

  const handleOpenChange = (isOpen: boolean) => {
    setUncontrolledOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time) return;

    const startAt = new Date(`${form.date}T${form.time}:00`).getTime();
    setPending(true);
    try {
      await createEntry({
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt,
        endAt: durationMinutes ? startAt + durationMinutes * 60 * 1000 : undefined,
        source: 'PERSONAL',
      });
      handleOpenChange(false);
      setForm(initialForm(initialDate));
      toast({ title: 'Reminder added to your calendar' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to add reminder',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        handleOpenChange(isOpen);
        if (isOpen) {
          setForm(initialForm(initialDate));
        }
      }}
    >
      {trigger === undefined ? (
        <DialogTrigger asChild>
          <Button size="sm" leadingIcon={Plus} className="rounded-xl">
            Add Reminder
          </Button>
        </DialogTrigger>
      ) : trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-foreground/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="text-primary" size={20} />
            Add Personal Reminder
          </DialogTitle>
          <DialogDescription>
            Add a private reminder or due date — only visible to you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Title
            </Label>
            <div className="relative">
              <Input
                id="title"
                placeholder="e.g., Assignment due, Study session..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
                className="rounded-2xl pl-10 h-12 border-foreground/5 bg-foreground/[0.02]"
                required
              />
              <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Date
              </Label>
              <DatePicker
                value={form.date}
                onChange={(date) => setForm({ ...form, date })}
                buttonClassName="rounded-2xl h-12 border-foreground/5 bg-foreground/[0.02]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="time" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Time
              </Label>
              <div className="relative">
                <Input
                  id="time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="rounded-2xl pl-10 h-12 border-foreground/5 bg-foreground/[0.02]"
                  required
                />
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Location (Optional)
            </Label>
            <div className="relative">
              <Input
                id="location"
                placeholder="Where is it happening?"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded-2xl pl-10 h-12 border-foreground/5 bg-foreground/[0.02]"
              />
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Details (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Any extra notes..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={2000}
              className="rounded-2xl min-h-[90px] border-foreground/5 bg-foreground/[0.02] resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl h-12 text-base font-semibold"
            >
              {pending ? 'Saving...' : 'Add to My Calendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

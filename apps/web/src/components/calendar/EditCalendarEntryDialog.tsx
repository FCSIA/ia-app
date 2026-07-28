'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
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
import { Edit3, Clock, MapPin, AlignLeft, Trash } from 'lucide-react';
import { format } from 'date-fns';
import { Id } from '~/apps/convex/src/_generated/dataModel';

interface EditCalendarEntryDialogProps {
  entry: {
    _id: Id<"calendarEntries">;
    title: string;
    description?: string;
    location?: string;
    startAt: number;
    endAt?: number;
    source: string;
    createdById?: string;
  };
  trigger?: (onOpen: () => void) => React.ReactNode;
}

export function EditCalendarEntryDialog({ entry, trigger }: EditCalendarEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: entry.title,
    description: entry.description || '',
    location: entry.location || '',
    date: format(new Date(entry.startAt), 'yyyy-MM-dd'),
    time: format(new Date(entry.startAt), 'HH:mm'),
  });

  const updateEntry = useMutation(api.events.calendar.update);
  const removeEntry = useMutation(api.events.calendar.remove);
  const [pending, setPending] = useState(false);
  const isPersonal = entry.source === 'PERSONAL';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time) return;

    const startAt = new Date(`${form.date}T${form.time}:00`).getTime();
    setPending(true);
    try {
      await updateEntry({
        entryId: entry._id,
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        startAt,
      });
      setOpen(false);
      toast({ title: 'Reminder updated successfully' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to add reminder',
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setPending(true);
    try {
      await removeEntry({ entryId: entry._id });
      setOpen(false);
      toast({ title: 'Event deleted' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to delete event',
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
        setOpen(isOpen);
        if (isOpen) {
          setForm({
            title: entry.title,
            description: entry.description || '',
            location: entry.location || '',
            date: format(new Date(entry.startAt), 'yyyy-MM-dd'),
            time: format(new Date(entry.startAt), 'HH:mm'),
          });
        }
      }}
    >
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <div className="cursor-pointer" onDoubleClick={() => setOpen(true)}>
          {entry.title}
        </div>
      )}
      <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-foreground/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Edit3 className="text-primary" size={20} />
            {isPersonal ? 'Edit Personal Reminder' : 'View Event'}
          </DialogTitle>
          <DialogDescription>
            {isPersonal ? 'Update your private reminder details.' : 'Shared calendar event.'}
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
                className="rounded-2xl pl-10 h-12 border-foreground/5 bg-foreground/[0.02]"
                readOnly={!isPersonal}
                required
              />
              <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Date
              </Label>
              <DatePicker
                value={form.date}
                onChange={(date) => isPersonal && setForm({ ...form, date })}
                buttonClassName="rounded-2xl h-12 border-foreground/5 bg-foreground/[0.02]"
              />
            </div>
            <div className="space-y-2">
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
                  readOnly={!isPersonal}
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
                readOnly={!isPersonal}
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
              className="rounded-2xl min-h-[90px] border-foreground/5 bg-foreground/[0.02] resize-none"
              readOnly={!isPersonal}
            />
          </div>

          {isPersonal && (
            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="tertiary"
                onClick={handleDelete}
                disabled={pending}
                className="flex-1 rounded-2xl h-12 text-base font-semibold text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash size={18} className="mr-2" /> Delete
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className="flex-[2] rounded-2xl h-12 text-base font-semibold"
              >
                {pending ? 'Saving...' : 'Update Reminder'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

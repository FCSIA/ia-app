'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
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
import { Plus, Clock, MapPin, AlignLeft } from 'lucide-react';
import { format } from 'date-fns';

interface AddCalendarEntryDialogProps {
  initialDate?: Date;
  trigger?: React.ReactNode;
}

export function AddCalendarEntryDialog({ initialDate, trigger }: AddCalendarEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => calendarApi.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setOpen(false);
      setForm({
        title: '',
        description: '',
        location: '',
        date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        time: '08:00',
      });
      toast({ title: 'Event added to calendar' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to add event',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time) return;

    const startAt = new Date(`${form.date}T${form.time}:00`);
    
    createMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      startAt: startAt.toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="flex items-center gap-2 rounded-xl">
            <Plus size={16} /> Add Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-foreground/10 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="text-accent-500" size={20} />
            Add Calendar Event
          </DialogTitle>
          <DialogDescription>
            Create a custom entry on the school calendar for everyone to see.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Event Title
            </Label>
            <div className="relative">
              <Input
                id="title"
                placeholder="e.g., Study Group, Practice Game..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-2xl pl-10 h-12 border-foreground/5 bg-foreground/[0.02]"
                required
              />
              <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-2xl h-12 border-foreground/5 bg-foreground/[0.02]"
                required
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
              placeholder="Tell us more about this event..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-2xl min-h-[100px] border-foreground/5 bg-foreground/[0.02] resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="submit" disabled={createMutation.isPending} className="w-full rounded-2xl h-12 text-base font-semibold shadow-lg shadow-accent-500/20">
              {createMutation.isPending ? 'Adding Event...' : 'Add to Calendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

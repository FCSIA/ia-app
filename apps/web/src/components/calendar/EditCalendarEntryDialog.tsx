'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit3, Clock, MapPin, AlignLeft, Trash, UserPlus } from 'lucide-react';
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
    inviteId?: Id<'calendarInvites'>;
    sharedBy?: { firstName: string; lastName: string };
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
  const inviteFriends = useMutation(api.events.calendar.inviteFriends);
  const friends = useQuery(api.events.calendar.listEligibleFriends, open ? {} : 'skip');
  const [pending, setPending] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Id<'users'>[]>([]);
  const isOwnedPersonal = entry.source === 'PERSONAL' && !entry.inviteId;

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

  const handleInviteFriends = async () => {
    if (selectedFriendIds.length === 0) return;
    setPending(true);
    try {
      const result = await inviteFriends({ entryId: entry._id, friendIds: selectedFriendIds });
      setSelectedFriendIds([]);
      toast({ title: result.invited === 1 ? 'Invite sent' : `${result.invited} invites sent` });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to send invites',
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
          setSelectedFriendIds([]);
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
            {isOwnedPersonal ? 'Edit Personal Reminder' : 'View Event'}
          </DialogTitle>
          <DialogDescription>
            {isOwnedPersonal
              ? 'Update your reminder details or invite accepted friends.'
              : entry.sharedBy
                ? `Shared with you by ${entry.sharedBy.firstName} ${entry.sharedBy.lastName}.`
                : 'Shared calendar event.'}
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
                readOnly={!isOwnedPersonal}
                maxLength={255}
                required
              />
              <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            </div>
            {form.title.length >= 255 && (
              <p className="text-xs text-destructive mt-1 ml-1">Maximum length of 255 characters reached.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Date
              </Label>
              <DatePicker
                value={form.date}
                onChange={(date) => isOwnedPersonal && setForm({ ...form, date })}
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
                  readOnly={!isOwnedPersonal}
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
                readOnly={!isOwnedPersonal}
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
              readOnly={!isOwnedPersonal}
              maxLength={255}
            />
            {form.description.length >= 255 && (
              <p className="text-xs text-destructive mt-1 ml-1">Maximum length of 255 characters reached.</p>
            )}
          </div>

          {isOwnedPersonal && (
            <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserPlus className="size-4 text-primary" />
                Invite friends
              </div>
              {friends === undefined ? (
                <p className="text-sm text-muted-foreground">Loading friends...</p>
              ) : friends.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add accepted friends from Schedules to share this reminder.</p>
              ) : (
                <div className="max-h-32 space-y-2 overflow-y-auto pr-1">
                  {friends.map((friend) => {
                    const checked = selectedFriendIds.includes(friend._id);
                    return (
                      <label key={friend._id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) =>
                            setSelectedFriendIds((current) =>
                              nextChecked
                                ? [...current, friend._id]
                                : current.filter((id) => id !== friend._id),
                            )
                          }
                        />
                        {friend.firstName} {friend.lastName}
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedFriendIds.length > 0 && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={handleInviteFriends}
                  disabled={pending}
                >
                  Send invite{selectedFriendIds.length === 1 ? '' : 's'}
                </Button>
              )}
            </div>
          )}

          {isOwnedPersonal && (
            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="tertiary"
                leadingIcon={Trash}
                onClick={handleDelete}
                disabled={pending}
                className="flex-1 rounded-2xl h-12 text-base font-semibold text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                Delete
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

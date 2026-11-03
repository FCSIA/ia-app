'use client';

import { useEffect, useState } from 'react';
import { Check, Trash, UserPlus } from 'lucide-react';
import { displayName, nameSearchValues } from '~/apps/shared/user-name';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { api } from '~/apps/convex/src/_generated/api';
import { useMutation, useQuery } from '@/lib/convex-react';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { ReminderForm, reminderPayload, reminderValues } from './reminder-form';

interface EditCalendarEntryDialogProps {
  entry: {
    _id: Id<'calendarEntries'>;
    title: string;
    description?: string;
    location?: string;
    startAt: number;
    endAt?: number;
    allDay?: boolean;
    source: string;
  };
  trigger?: ((onOpen: () => void) => React.ReactNode) | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditCalendarEntryDialog({
  entry,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: EditCalendarEntryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [form, setForm] = useState(() => reminderValues(entry));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Id<'users'>[]>([]);
  const { toast } = useToast();
  const user = useCurrentUser();
  const isStudent =
    !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN');
  const update = useMutation(api.events.calendar.update);
  const remove = useMutation(api.events.calendar.remove);
  const invite = useMutation(api.events.calendar.inviteFriends);
  const friends = useQuery(
    api.events.calendar.listEligibleFriends,
    open && isStudent ? {} : 'skip',
  );
  useEffect(() => {
    if (open) {
      setForm(reminderValues(entry));
      setError(undefined);
      setSelected([]);
    }
  }, [open, entry]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await update({ entryId: entry._id, ...reminderPayload(form) });
      setOpen(false);
      toast({ title: 'Reminder updated' });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save the reminder.',
      );
    } finally {
      setPending(false);
    }
  }
  async function deleteReminder() {
    setPending(true);
    setError(undefined);
    try {
      await remove({ entryId: entry._id });
      setOpen(false);
      toast({ title: 'Reminder deleted' });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not delete the reminder.',
      );
    } finally {
      setPending(false);
    }
  }
  async function sendInvites() {
    setPending(true);
    setError(undefined);
    try {
      const result = await invite({ entryId: entry._id, friendIds: selected });
      setSelected([]);
      toast({
        title:
          result.invited === 1
            ? 'Invite sent'
            : `${result.invited} invites sent`,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not send the invitation.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger?.(() => setOpen(true))}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit reminder</DialogTitle>
          <DialogDescription className="sr-only">
            Update the details of your reminder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-6">
          <ReminderForm values={form} onChange={setForm} disabled={pending} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  leadingIcon={Trash}
                  disabled={pending}
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this reminder?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{entry.title}” and its invitations will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void deleteReminder()}
                  >
                    Delete reminder
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {isStudent ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="tertiary"
                    leadingIcon={UserPlus}
                    disabled={pending}
                  >
                    Invite friends
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="space-y-3">
                  <p className="text-sm font-semibold">Invite friends</p>
                  {friends === undefined ? (
                    <p className="text-sm text-muted-foreground">
                      Loading friends…
                    </p>
                  ) : friends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Accept a friend request in Schedules to share reminders.
                    </p>
                  ) : (
                    <Command surface="inherit">
                      <CommandInput
                        placeholder="Search friends…"
                        aria-label="Search friends to invite"
                      />
                      <CommandList className="max-h-48">
                        <CommandEmpty>No friends found.</CommandEmpty>
                        <CommandGroup>
                          {friends.map((friend) => (
                            <CommandItem
                              key={friend._id}
                              value={friend._id}
                              keywords={nameSearchValues(friend)}
                              disabled={
                                pending ||
                                (selected.length >= 20 &&
                                  !selected.includes(friend._id))
                              }
                              onSelect={() =>
                                setSelected((ids) =>
                                  ids.includes(friend._id)
                                    ? ids.filter((id) => id !== friend._id)
                                    : [...ids, friend._id],
                                )
                              }
                            >
                              <Check
                                aria-hidden="true"
                                className={
                                  selected.includes(friend._id)
                                    ? undefined
                                    : 'opacity-0'
                                }
                              />
                              {displayName(friend)}
                              {selected.includes(friend._id) ? (
                                <span className="sr-only">
                                  , selected for invitation
                                </span>
                              ) : null}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                  {selected.length ? (
                    <Button
                      type="button"
                      size="sm"
                      loading={pending}
                      onClick={() => void sendInvites()}
                    >
                      Send {selected.length === 1 ? 'invite' : 'invites'}
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : null}
            <Button type="submit" loading={pending}>
              Save reminder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

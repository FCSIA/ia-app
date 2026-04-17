'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClubDirectoryEntry } from '@ia/contracts/clubs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { clubsApi } from '@/lib/api';
import { fullName } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: string;
  person: ClubDirectoryEntry | null;
  onOpenChange: (open: boolean) => void;
};

const OPTIONS = [
  { value: 'NONE', label: 'Member', detail: 'Regular club member' },
  { value: 'LEADER', label: 'Leader', detail: 'Can invite members, post announcements, create channels' },
];

export function SetRoleDialog({ clubId, person, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState<string>('NONE');

  useEffect(() => {
    setRole(person?.clubRole ? person.clubRole.toUpperCase() : 'NONE');
  }, [person]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!person) throw new Error('No person');
      return clubsApi.setMemberRole(clubId, person.id, role === 'NONE' ? undefined : role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast({ title: 'Role updated' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set club role</DialogTitle>
          <DialogDescription>
            {person ? fullName(person) : ''}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
          {OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`role-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]"
            >
              <RadioGroupItem id={`role-${option.value}`} value={option.value} className="mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.detail}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { useClubId } from '@/app/clubs/club-route';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { fullName, type ClubDirectoryEntry } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

type Props = {
  person: ClubDirectoryEntry | null;
  onOpenChange: (open: boolean) => void;
};

const OPTIONS = [
  { value: 'NONE', label: 'Regular Member', detail: 'No administrative permissions' },
  { value: 'LEADER', label: 'Leader', detail: 'Can invite members, manage channels, and post announcements' },
];

export function SetRoleDialog({ person, onOpenChange }: Props) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [role, setRole] = useState<string>('NONE');
  const personId = person?._id ?? null;
  const [previousPersonId, setPreviousPersonId] = useState<string | null>(personId);
  const setMemberRole = useMutation(api.clubs.management.setMemberRole);

  if (previousPersonId !== personId) {
    setPreviousPersonId(personId);
    if (person) {
      const current = person.clubRole?.toUpperCase() || 'NONE';
      setRole(current === 'LEADER' ? 'LEADER' : 'NONE');
    }
  }

  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set club role</DialogTitle>
          <DialogDescription>{person ? fullName(person) : ''}</DialogDescription>
        </DialogHeader>

        <Alert className="bg-primary/5 border-primary/20">
          <Shield className="size-4 text-primary" />
          <AlertTitle className="text-sm font-semibold text-primary">Leader Permissions</AlertTitle>
          <AlertDescription className="text-xs text-primary/80">
            Leaders can invite members, manage channels, and post announcements.
          </AlertDescription>
        </Alert>

        <RadioGroup value={role} onValueChange={setRole} className="w-full">
          {OPTIONS.map((option, index) => (
            <RadioItem
              key={option.value}
              index={index}
              value={option.value}
              label={option.label}
            />
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {OPTIONS.find((option) => option.value === role)?.detail}
        </p>

        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!person) return;
              void setMemberRole({
                clubId,
                memberId: person._id,
                role: role === 'LEADER' ? 'LEADER' : 'MEMBER',
              }).then(() => {
                toast({ title: 'Role updated' });
                onOpenChange(false);
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

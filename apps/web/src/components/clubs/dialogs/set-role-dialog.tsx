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
import { Label } from '@/components/ui/label';
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

        <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
          {OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`role-${option.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]"
            >
              <RadioItem index={0} value={option.value} label={option.label} className="p-0" />
              <div className="space-y-0.5 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.detail}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>

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

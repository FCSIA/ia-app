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
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { clubsApi } from '@/lib/api';
import { fullName } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

type Props = {
  clubId: string;
  person: ClubDirectoryEntry | null;
  onOpenChange: (open: boolean) => void;
};

const OPTIONS = [
  { value: 'NONE', label: 'Regular Member', detail: 'No administrative permissions' },
  { value: 'LEADER', label: 'Standard Leader', detail: 'Can invite members, manage channels, and post announcements' },
  { value: 'CUSTOM', label: 'Custom Leadership Title...', detail: 'Enter a specific title (e.g. Captain, President, Secretary)' },
];

export function SetRoleDialog({ clubId, person, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState<string>('NONE');
  const [customRole, setCustomRole] = useState('');

  useEffect(() => {
    if (!person) return;
    const current = person.clubRole?.toUpperCase() || 'NONE';
    if (current === 'NONE' || current === 'LEADER') {
      setRole(current);
      setCustomRole('');
    } else {
      setRole('CUSTOM');
      setCustomRole(person.clubRole || '');
    }
  }, [person]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!person) throw new Error('No person');
      const finalRole = role === 'CUSTOM' ? customRole.trim() : (role === 'NONE' ? undefined : role);
      return clubsApi.setMemberRole(clubId, person.id, finalRole || undefined);
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

        <Alert className="bg-primary/5 border-primary/20">
          <Shield className="size-4 text-primary" />
          <AlertTitle className="text-sm font-semibold text-primary">Leader Permissions</AlertTitle>
          <AlertDescription className="text-xs text-primary/80">
            Assigning any leadership role (standard or custom) grants this user administrative control over channels and membership.
          </AlertDescription>
        </Alert>

        <RadioGroup value={role} onValueChange={setRole} className="space-y-2">
          {OPTIONS.map((option) => (
            <div key={option.value} className="space-y-2">
              <Label
                htmlFor={`role-${option.value}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]"
              >
                <RadioGroupItem id={`role-${option.value}`} value={option.value} className="mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.detail}</p>
                </div>
              </Label>
              {option.value === 'CUSTOM' && role === 'CUSTOM' && (
                <div className="px-1 pb-2">
                  <Input
                    autoFocus
                    placeholder="Enter role title (e.g. President)"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="h-9"
                    maxLength={64}
                  />
                </div>
              )}
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (role === 'CUSTOM' && !customRole.trim())}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

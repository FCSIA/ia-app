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
import { Shield, Settings } from 'lucide-react';

type Props = {
  clubId: string;
  person: ClubDirectoryEntry | null;
  onOpenChange: (open: boolean) => void;
};

const OPTIONS = [
  { value: 'NONE', label: 'Regular Member', detail: 'No administrative permissions' },
  { value: 'LEADER', label: 'Leader', detail: 'Can invite members, manage channels, and post announcements' },
];

export function SetRoleDialog({ clubId, person, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState<string>('NONE');
  const [customRole, setCustomRole] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    if (!person) return;
    const current = person.clubRole?.toUpperCase() || 'NONE';
    if (current === 'NONE' || current === 'LEADER') {
      setRole(current);
      setCustomRole('');
      setIsCustomizing(false);
    } else {
      setRole('LEADER');
      setCustomRole(person.clubRole || '');
      setIsCustomizing(true);
    }
  }, [person]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!person) throw new Error('No person');
      let finalRole: string | undefined;
      if (role === 'NONE') {
        finalRole = undefined;
      } else {
        finalRole = isCustomizing && customRole.trim() ? customRole.trim() : 'LEADER';
      }
      return clubsApi.setMemberRole(clubId, person.id, finalRole);
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
                className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04] relative items-center"
              >
                <RadioGroupItem id={`role-${option.value}`} value={option.value} />
                <div className="space-y-0.5 flex-1">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.detail}</p>
                </div>
                {option.value === 'LEADER' && role === 'LEADER' && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsCustomizing((current) => !current);
                    }}
                  >
                    <Settings className="size-4" />
                  </Button>
                )}
              </Label>
              {option.value === 'LEADER' && role === 'LEADER' && isCustomizing && (
                <div className="px-1 pb-2 pt-1 animate-in slide-in-from-top-2 fade-in">
                  <Input
                    autoFocus
                    placeholder="Enter custom title (e.g. President, Captain)"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="h-9"
                    maxLength={64}
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground ml-1">
                    Leaving this blank will use the standard &quot;Leader&quot; title.
                  </p>
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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

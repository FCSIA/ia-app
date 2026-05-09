'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClubDetail } from '@ia/contracts/clubs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTagDialog({ clubId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', clubId],
    queryFn: () => clubsApi.getOne(clubId).then((r) => r.data),
    enabled: open,
  });

  const memberOptions = useMemo(
    () => (club?.directory ?? []).filter((person) => person.kind === 'MEMBER'),
    [club?.directory],
  );

  const mutation = useMutation({
    mutationFn: () =>
      clubsApi.createTag(clubId, { name: name.trim(), memberIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast({ title: 'Tag created' });
      setName('');
      setMemberIds([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create tag',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New mention tag</DialogTitle>
          <DialogDescription>
            Reusable mention group. Use `@name` in any channel to ping everyone in the tag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-name">Tag name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="officers, outreach, media"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Members</Label>
            <PeoplePicker
              people={memberOptions}
              selectedIds={memberIds}
              onChange={setMemberIds}
              placeholder="Select members"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
          >
            {mutation.isPending ? 'Creating…' : 'Create tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

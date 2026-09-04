'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { type ClubDetail } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTagDialog({ open, onOpenChange }: Props) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const club = useQuery(api.clubs.detail.get, open ? { clubId } : 'skip') as ClubDetail | undefined;
  const createTag = useMutation(api.clubs.tags.create);

  const memberOptions = useMemo(
    () => (club?.directory ?? []).filter((person) => person.kind === 'MEMBER'),
    [club?.directory],
  );

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
            onClick={() =>
              void createTag({
                clubId,
                name: name.trim(),
                memberIds: memberIds as Id<'users'>[],
              }).then(() => {
                toast({ title: 'Tag created' });
                setName('');
                setMemberIds([]);
                onOpenChange(false);
              })
            }
            disabled={!name.trim()}
          >
            Create tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

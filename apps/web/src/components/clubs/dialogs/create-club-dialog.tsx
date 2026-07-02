'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { SliderComfortable } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { PeoplePicker, SelectablePerson } from '@/components/clubs/people-picker';
import { fullName, isSponsorEligible } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateClubDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorIds, setSponsorIds] = useState<string[]>([]);
  const [joinPolicy, setJoinPolicy] = useState<'OPEN' | 'REQUEST'>('OPEN');
  const [memberLimit, setMemberLimit] = useState(40);

  const staffPage = useQuery(
    api.users.admin.list,
    open
      ? {
          paginationOpts: { numItems: 250, cursor: null },
          roleGroup: 'teachers' as const,
        }
      : 'skip',
  );

  const sponsorOptions = useMemo((): SelectablePerson[] => {
    return (staffPage?.page ?? [])
      .map((user) => ({
        _id: user._id,
        uniqueId: user.uniqueId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email ?? null,
        roles: user.roles,
        avatarUrl: user.avatarUrl ?? null,
      }))
      .filter(isSponsorEligible)
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [staffPage?.page]);

  const createClub = useMutation(api.clubs.management.create);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create club</DialogTitle>
          <DialogDescription>
            Set up a new club workspace with sponsors and membership rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="club-name">Name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Robotics Club"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-description">Description</Label>
            <Textarea
              id="club-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What does this club do?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Sponsors</Label>
            <PeoplePicker
              people={sponsorOptions}
              selectedIds={sponsorIds}
              onChange={setSponsorIds}
              placeholder="Select faculty sponsors"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="join-policy">Join policy</Label>
              <Select value={joinPolicy} onValueChange={(value) => setJoinPolicy(value as 'OPEN' | 'REQUEST')}>
                <SelectTrigger id="join-policy" placeholder="Choose policy" />
                <SelectContent>
                  <SelectItem index={0} value="OPEN">
                    Open join
                  </SelectItem>
                  <SelectItem index={0} value="REQUEST">
                    Request approval
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:col-span-2">
              <div>
                <Label>Member limit</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  New joins and approvals stop once this club reaches the selected limit.
                </p>
              </div>
              <SliderComfortable
                value={memberLimit}
                onChange={setMemberLimit}
                min={10}
                max={200}
                step={10}
                label="Limit"
                formatValue={(value) => `${value} members`}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void createClub({
                name: name.trim(),
                description: description.trim() || undefined,
                joinPolicy,
                memberLimit,
                sponsorIds: sponsorIds as Id<'users'>[],
              }).then(() => {
                toast({ title: 'Club created' });
                setName('');
                setDescription('');
                setSponsorIds([]);
                setJoinPolicy('OPEN');
                setMemberLimit(40);
                onOpenChange(false);
              })
            }
            disabled={!name.trim()}
          >
            Create club
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

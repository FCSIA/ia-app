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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
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
    const options: SelectablePerson[] = [];

    for (const user of staffPage?.page ?? []) {
      const option = {
        _id: user._id,
        uniqueId: user.uniqueId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email ?? null,
        roles: user.roles,
        avatarUrl: user.avatarUrl ?? null,
      };

      if (isSponsorEligible(option)) {
        options.push(option);
      }
    }

    return options.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [staffPage?.page]);

  const createClub = useMutation(api.clubs.management.create);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create club</DialogTitle>
          <DialogDescription>
            Set up a new club workspace with sponsors and membership rules.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="club-name">Name</FieldLabel>
            <Input
              id="club-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Robotics Club"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="club-description">Description</FieldLabel>
            <Textarea
              id="club-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What does this club do?"
            />
          </Field>

          <Field>
            <FieldLabel>Sponsors</FieldLabel>
            <FieldDescription>Choose one or more faculty members to sponsor this club.</FieldDescription>
            <PeoplePicker
              people={sponsorOptions}
              selectedIds={sponsorIds}
              onChange={setSponsorIds}
              placeholder="Select faculty sponsors"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="join-policy">Join policy</FieldLabel>
              <Select value={joinPolicy} onValueChange={(value) => setJoinPolicy(value as 'OPEN' | 'REQUEST')}>
                <SelectTrigger id="join-policy" placeholder="Choose policy" />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem index={0} value="OPEN">
                      Open join
                    </SelectItem>
                    <SelectItem index={1} value="REQUEST">
                      Request approval
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel>Member limit</FieldLabel>
              <FieldDescription>New joins and approvals stop at this limit.</FieldDescription>
              <Slider
                value={memberLimit}
                onChange={setMemberLimit}
                min={10}
                max={200}
                step={10}
                label="Members"
                formatValue={(value) => `${value} members`}
                showSteps
                valuePosition="top"
              />
            </Field>
          </div>
        </FieldGroup>

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

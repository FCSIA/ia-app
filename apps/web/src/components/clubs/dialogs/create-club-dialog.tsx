'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { clubsApi, usersApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type UserDirectoryResponse = {
  users: Array<SelectablePerson>;
};

export function CreateClubDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sponsorIds, setSponsorIds] = useState<string[]>([]);
  const [joinPolicy, setJoinPolicy] = useState<'OPEN' | 'REQUEST'>('OPEN');
  const [memberLimit, setMemberLimit] = useState(40);

  const { data: staff } = useQuery<UserDirectoryResponse>({
    queryKey: ['club-sponsor-directory'],
    queryFn: () => usersApi.getAll(1, 250).then((r) => r.data),
    enabled: open,
  });

  const sponsorOptions = useMemo(
    () =>
      (staff?.users ?? [])
        .filter(isSponsorEligible)
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [staff?.users],
  );

  const mutation = useMutation({
    mutationFn: () =>
      clubsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        sponsorIds,
        joinPolicy,
        memberLimit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['my-clubs'] });
      toast({ title: 'Club created' });
      setName('');
      setDescription('');
      setSponsorIds([]);
      setJoinPolicy('OPEN');
      setMemberLimit(40);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create club',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: 'Club name is required', variant: 'destructive' });
      return;
    }
    if (sponsorIds.length === 0) {
      toast({ title: 'At least one teacher sponsor is required', variant: 'destructive' });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create club</DialogTitle>
          <DialogDescription>
            Every club requires at least one staff advisor who has visibility into all channels.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="club-name">Name</Label>
            <Input
              id="club-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Robotics, Debate, Esports…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="club-description">Description (optional)</Label>
            <Textarea
              id="club-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What is this club for?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Join behavior</Label>
            <Select value={joinPolicy} onValueChange={(value) => setJoinPolicy(value as 'OPEN' | 'REQUEST')}>
              <SelectTrigger placeholder="" />
              <SelectContent>
                <SelectItem index={0} value="OPEN">Anyone can join</SelectItem>
                <SelectItem index={0} value="REQUEST">Requires approval</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Staff advisors</Label>
            <PeoplePicker
              people={sponsorOptions}
              selectedIds={sponsorIds}
              onChange={setSponsorIds}
              placeholder="Select sponsors"
              emptyText="No advisor-eligible staff found."
            />
          </div>

          <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-3">
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

        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create club'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

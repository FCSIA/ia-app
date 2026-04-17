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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateChannelDialog({ clubId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
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
      clubsApi.createChannel(clubId, {
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate,
        memberIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast({ title: 'Channel created' });
      setName('');
      setDescription('');
      setIsPrivate(false);
      setMemberIds([]);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create channel',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>
            Public channels are visible to every club member. Private channels restrict access to the selected members; sponsors always retain visibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="announcements, build-team, officers"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What is this channel for?"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Private</p>
              <p className="text-xs text-muted-foreground">Restrict to selected members</p>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={(checked) => {
                setIsPrivate(checked);
                if (!checked) setMemberIds([]);
              }}
            />
          </div>

          {isPrivate ? (
            <div className="space-y-1.5">
              <Label>Members</Label>
              <PeoplePicker
                people={memberOptions}
                selectedIds={memberIds}
                onChange={setMemberIds}
                placeholder="Select members"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
          >
            {mutation.isPending ? 'Creating…' : 'Create channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

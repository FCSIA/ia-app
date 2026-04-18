'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClubChannelVisibility, ClubDetail } from '@ia/contracts/clubs';
import {
  getClubChannelVisibilityDescription,
  getClubChannelVisibilityLabel,
} from '@/components/clubs/channel-visibility';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [visibility, setVisibility] = useState<ClubChannelVisibility>('PUBLIC');
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
        visibility,
        memberIds: visibility === 'PRIVATE' ? memberIds : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast({ title: 'Channel created' });
      setName('');
      setDescription('');
      setVisibility('PUBLIC');
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
            Pick how the club should use this space. Public channels are open to all members, private channels are invitation-only, and read-only channels work well for announcements.
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

          <div className="space-y-1.5">
            <Label htmlFor="channel-visibility">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) => {
                setVisibility(value as ClubChannelVisibility);
                if (value !== 'PRIVATE') setMemberIds([]);
              }}
            >
              <SelectTrigger id="channel-visibility">
                <SelectValue placeholder="Choose a visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="MEMBER_READONLY">Member read only</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {getClubChannelVisibilityDescription(visibility)}
            </p>
          </div>

          {visibility === 'PRIVATE' ? (
            <div className="space-y-1.5">
              <Label>Members</Label>
              <PeoplePicker
                people={memberOptions}
                selectedIds={memberIds}
                onChange={setMemberIds}
                placeholder={`Select people for ${getClubChannelVisibilityLabel(visibility).toLowerCase()} access`}
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

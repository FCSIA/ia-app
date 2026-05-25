'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  getClubChannelVisibilityDescription,
  getClubChannelVisibilityLabel,
} from '@/components/clubs/channel-visibility';
import type { ClubChannelVisibility } from '@ia/contracts/clubs';
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
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { type ClubChannel, type ClubDetail } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: Id<'clubs'>;
  channel?: ClubChannel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChannelDialog({ clubId, channel, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ClubChannelVisibility>('PUBLIC');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const isEdit = !!channel;
  const createChannel = useMutation(api.clubs.channels.create);
  const updateChannel = useMutation(api.clubs.channels.update);

  useEffect(() => {
    if (open) {
      setName(channel?.name ?? '');
      setDescription(channel?.description ?? '');
      setVisibility(channel?.visibility ?? 'PUBLIC');
      setMemberIds(channel?.memberships?.map((m) => m.userId) ?? []);
    }
  }, [open, channel]);

  const club = useQuery(api.clubs.detail.get, open ? { clubId } : 'skip') as ClubDetail | undefined;

  const memberOptions = useMemo(
    () => (club?.directory ?? []).filter((person) => person.kind === 'MEMBER'),
    [club?.directory],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit channel' : 'New channel'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the channel settings and permissions.'
              : 'Pick how the club should use this space. Public channels are open to all members, private channels are invitation-only, and read-only channels work well for announcements.'}
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
              <SelectTrigger id="channel-visibility" placeholder="Choose a visibility" />
              <SelectContent>
                <SelectItem index={0} value="PUBLIC">
                  Public
                </SelectItem>
                <SelectItem index={0} value="MEMBER_READONLY">
                  Member read only
                </SelectItem>
                <SelectItem index={0} value="PRIVATE">
                  Private
                </SelectItem>
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
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                visibility,
              };
              if (isEdit && channel) {
                void updateChannel({ channelId: channel._id, ...payload }).then(() => {
                  toast({ title: 'Channel updated' });
                  onOpenChange(false);
                });
              } else {
                void createChannel({ clubId, ...payload }).then(() => {
                  toast({ title: 'Channel created' });
                  setName('');
                  setDescription('');
                  setVisibility('PUBLIC');
                  setMemberIds([]);
                  onOpenChange(false);
                });
              }
            }}
            disabled={!name.trim()}
          >
            {isEdit ? 'Save changes' : 'Create channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

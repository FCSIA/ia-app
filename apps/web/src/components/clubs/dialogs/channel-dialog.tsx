'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  type ClubChannelVisibility,
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
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PeoplePicker } from '@/components/clubs/people-picker';
import { Switch } from '@/components/ui/switch';
import { type ClubChannel, type ClubDetail } from '@/components/clubs/types';
import { useToast } from '@/hooks/use-toast';

type AudienceKind = 'CLUB' | 'UNIT_MEMBERS' | 'UNIT_LEADERS' | 'CUSTOM';
type PostingPolicy = 'AUDIENCE' | 'UNIT_LEADERS' | 'CLUB_MANAGERS';

type Props = {
  clubId: Id<'clubs'>;
  channel?: Pick<ClubChannel, '_id' | 'name' | 'description' | 'visibility' | 'memberships' | 'ownerUnitId' | 'audienceKind' | 'audienceUnitId' | 'includeDescendants' | 'includeAncestorLeaders' | 'postingPolicy'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChannelDialog({ clubId, channel, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ClubChannelVisibility>('PUBLIC');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('CLUB');
  const [audienceUnitId, setAudienceUnitId] = useState<string>('');
  const [ownerUnitId, setOwnerUnitId] = useState<string>('');
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [includeAncestorLeaders, setIncludeAncestorLeaders] = useState(false);
  const [postingPolicy, setPostingPolicy] = useState<PostingPolicy>('AUDIENCE');
  const channelId = channel?._id ?? null;
  const [previousTarget, setPreviousTarget] = useState({ open, channelId });

  const isEdit = !!channel;
  const createChannel = useMutation(api.clubs.channels.create);
  const updateChannel = useMutation(api.clubs.channels.update);

  if (previousTarget.open !== open || previousTarget.channelId !== channelId) {
    setPreviousTarget({ open, channelId });
    if (open) {
      setName(channel?.name ?? '');
      setDescription(channel?.description ?? '');
      setVisibility(channel?.visibility ?? 'PUBLIC');
      setMemberIds(channel?.memberships?.map((m) => m.userId) ?? []);
      setAudienceKind(channel?.audienceKind ?? (channel?.visibility === 'PRIVATE' ? 'CUSTOM' : 'CLUB'));
      setAudienceUnitId(channel?.audienceUnitId ?? '');
      setOwnerUnitId(channel?.ownerUnitId ?? '');
      setIncludeDescendants(channel?.includeDescendants ?? false);
      setIncludeAncestorLeaders(channel?.includeAncestorLeaders ?? false);
      setPostingPolicy(channel?.postingPolicy ?? (channel?.visibility === 'MEMBER_READONLY' ? 'CLUB_MANAGERS' : 'AUDIENCE'));
    }
  }

  const club = useQuery(api.clubs.detail.get, open ? { clubId } : 'skip') as ClubDetail | undefined;
  const hierarchy = useQuery(api.clubs.hierarchy.list, open ? { clubId } : 'skip');

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
            <Label htmlFor="channel-audience">Audience</Label>
            <Select
              value={audienceKind}
              onValueChange={(value) => {
                const next = value as AudienceKind;
                setAudienceKind(next);
                setVisibility(next === 'CUSTOM' ? 'PRIVATE' : 'PUBLIC');
              }}
            >
              <SelectTrigger id="channel-audience" placeholder="Choose who can read" />
              <SelectContent>
                <SelectItem index={0} value="CLUB">Everyone in the club</SelectItem>
                <SelectItem index={1} value="UNIT_MEMBERS">A unit and its members</SelectItem>
                <SelectItem index={2} value="UNIT_LEADERS">Unit leaders only</SelectItem>
                <SelectItem index={3} value="CUSTOM">Selected people</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose the people who can see this channel. Channel placement is configured separately.</p>
          </div>

          {audienceKind === 'UNIT_MEMBERS' || audienceKind === 'UNIT_LEADERS' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="channel-audience-unit">Audience unit</Label>
                <Select value={audienceUnitId} onValueChange={setAudienceUnitId}>
                  <SelectTrigger id="channel-audience-unit" placeholder="Choose a House or Room" />
                  <SelectContent>
                    {(hierarchy?.units ?? []).map((unit, index) => <SelectItem key={unit._id} index={index} value={unit._id}>{unit.name}{unit.kind ? ` · ${unit.kind}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-sm font-medium">Include descendant units</p><p className="text-xs text-muted-foreground">Include people assigned to Rooms below this unit.</p></div>
                <Switch checked={includeDescendants} onCheckedChange={setIncludeDescendants} aria-label="Include descendant units" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-sm font-medium">Parent leader oversight</p><p className="text-xs text-muted-foreground">Allow leaders above this unit to read and lead where needed.</p></div>
                <Switch checked={includeAncestorLeaders} onCheckedChange={setIncludeAncestorLeaders} aria-label="Include parent leaders" />
              </div>
            </>
          ) : null}

          {audienceKind === 'CUSTOM' ? (
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

          <div className="space-y-1.5">
            <Label htmlFor="channel-posting">Who can post</Label>
            <Select value={postingPolicy} onValueChange={(value) => {
              const next = value as PostingPolicy;
              setPostingPolicy(next);
              setVisibility(next === 'CLUB_MANAGERS' ? 'MEMBER_READONLY' : audienceKind === 'CUSTOM' ? 'PRIVATE' : 'PUBLIC');
            }}>
              <SelectTrigger id="channel-posting" placeholder="Choose who can post" />
              <SelectContent>
                <SelectItem index={0} value="AUDIENCE">Everyone who can view</SelectItem>
                <SelectItem index={1} value="UNIT_LEADERS" disabled={audienceKind === 'CLUB' || audienceKind === 'CUSTOM'}>Unit leaders</SelectItem>
                <SelectItem index={2} value="CLUB_MANAGERS">Club managers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-location">Sidebar location</Label>
            <Select value={ownerUnitId} onValueChange={setOwnerUnitId}>
              <SelectTrigger id="channel-location" placeholder="Club-level channel" />
              <SelectContent>
                <SelectItem index={0} value="club">Club-level channel</SelectItem>
                {(hierarchy?.units ?? []).map((unit, index) => <SelectItem key={unit._id} index={index + 1} value={unit._id}>{unit.name}{unit.kind ? ` · ${unit.kind}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
                ownerUnitId: ownerUnitId === 'club' || !ownerUnitId ? undefined : ownerUnitId as Id<'clubUnits'>,
                audienceKind,
                audienceUnitId: audienceUnitId ? audienceUnitId as Id<'clubUnits'> : undefined,
                includeDescendants,
                includeAncestorLeaders,
                postingPolicy,
                memberIds: memberIds as Id<'users'>[],
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
            disabled={!name.trim() || ((audienceKind === 'UNIT_MEMBERS' || audienceKind === 'UNIT_LEADERS') && !audienceUnitId)}
          >
            {isEdit ? 'Save changes' : 'Create channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

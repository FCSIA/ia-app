'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@/lib/convex-react';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type Props = {
  clubId: Id<'clubs'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChannelDialog({ clubId, open, onOpenChange }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const createChannel = useMutation(api.clubs.channels.create);

  const create = async () => {
    setSaving(true);
    try {
      const channelId = await createChannel({
        clubId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onOpenChange(false);
      setName('');
      setDescription('');
      router.push(`/clubs/${clubId}/settings/channels/${channelId}`);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not create channel',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>
            Create the channel, then configure its access.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="channel-name">Name</FieldLabel>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="announcements, build-team, officers"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-description">Description</FieldLabel>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this channel for?"
              rows={3}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!name.trim()}
            onClick={() => void create()}
          >
            Create channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

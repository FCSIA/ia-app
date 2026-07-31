'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from 'convex/react';
import { Link2, Plus, Share2, Trash2, Users } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardGroup } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputCopy } from '@/components/ui/input-copy';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

type ShareMode = 'REQUEST' | 'AUTO_ACCEPT';

export function FriendCollaborationTools() {
  const groups = useQuery(api.schedule.groups.listMine);
  const links = useQuery(api.schedule.shareLinks.listMine);
  const createGroup = useMutation(api.schedule.groups.create);
  const createLink = useMutation(api.schedule.shareLinks.create);
  const revokeLink = useMutation(api.schedule.shareLinks.revoke);
  const router = useRouter();
  const { toast } = useToast();
  const [groupOpen, setGroupOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [shareMode, setShareMode] = useState<ShareMode>('REQUEST');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<'group' | 'link' | null>(null);
  const [optimisticallyRevoked, setOptimisticallyRevoked] = useState<Set<string>>(
    () => new Set(),
  );

  const activeLinks = useMemo(
    () =>
      (links ?? []).filter(
        (link) =>
          !link.revokedAt &&
          new Date(link.expiresAt).getTime() > Date.now() &&
          !optimisticallyRevoked.has(link.id),
      ),
    [links, optimisticallyRevoked],
  );

  const handleCreateGroup = async () => {
    if (!groupName.trim() || pending) return;
    setPending('group');
    try {
      const result = await createGroup({ name: groupName });
      setGroupOpen(false);
      setGroupName('');
      router.push(`/schedule/groups/${result.id}`);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not create group',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  const handleCreateLink = async () => {
    if (pending) return;
    setPending('link');
    try {
      const result = await createLink({ mode: shareMode });
      setCreatedUrl(`${window.location.origin}/schedule/friends/join/${result.token}`);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Could not create link',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  const handleRevoke = async (linkId: Id<'studentFriendShareLinks'>) => {
    setOptimisticallyRevoked((current) => new Set(current).add(linkId));
    try {
      await revokeLink({ linkId });
    } catch (error) {
      setOptimisticallyRevoked((current) => {
        const next = new Set(current);
        next.delete(linkId);
        return next;
      });
      toast({
        title: error instanceof Error ? error.message : 'Could not revoke link',
        variant: 'destructive',
      });
    }
  };

  const handleNativeShare = async () => {
    if (!createdUrl || !navigator.share) return;
    try {
      await navigator.share({ title: 'Add me as a friend', url: createdUrl });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ title: 'Could not open sharing', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Schedule groups
        </p>
        <div className="flex items-center gap-1.5">
          <Dialog
            open={shareOpen}
            onOpenChange={(open) => {
              setShareOpen(open);
              if (!open) setCreatedUrl(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
                <Link2 className="size-3.5" />
                Share link
              </Button>
            </DialogTrigger>
            <DialogContent size="lg" className="max-h-[85dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Share a friend link</DialogTitle>
                <DialogDescription>
                  The link expires in seven days. You can revoke it sooner.
                </DialogDescription>
              </DialogHeader>

              {createdUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-surface-2 p-3 shadow-surface-1">
                    <p className="mb-2 text-xs font-medium">Your link is ready</p>
                    <InputCopy value={createdUrl} variant="button" />
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    For security, the full link is shown only now. Create a new one if you lose it.
                  </p>
                  {typeof navigator !== 'undefined' && 'share' in navigator ? (
                    <Button variant="secondary" className="w-full" onClick={() => void handleNativeShare()}>
                      <Share2 className="size-4" />
                      Share
                    </Button>
                  ) : null}
                  <Button variant="ghost" className="w-full" onClick={() => setCreatedUrl(null)}>
                    Create another
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <RadioGroup
                    value={shareMode}
                    onValueChange={(value) => setShareMode(value as ShareMode)}
                    className="w-full rounded-xl bg-surface-2 p-1 shadow-surface-1"
                  >
                    <RadioItem index={0} value="REQUEST" label="Send me a friend request" />
                    <RadioItem index={1} value="AUTO_ACCEPT" label="Add us as friends immediately" />
                  </RadioGroup>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {shareMode === 'REQUEST'
                      ? 'Recommended. You decide whether to accept each person.'
                      : 'Anyone with this link becomes your friend without another approval. Share it only with people you trust.'}
                  </p>
                  <Button className="w-full" onClick={() => void handleCreateLink()} disabled={pending === 'link'}>
                    {pending === 'link' ? 'Creating…' : 'Create link'}
                  </Button>
                </div>
              )}

              {activeLinks.length > 0 ? (
                <div className="mt-5 border-t border-border/60 pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Active links
                  </p>
                  <div className="divide-y divide-border/60">
                    {activeLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {link.mode === 'REQUEST' ? 'Request approval' : 'Auto-accept'} · •{link.tokenHint}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })}
                            {link.useCount > 0 ? ` · ${link.useCount} used` : ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          aria-label="Revoke friend link"
                          onClick={() => void handleRevoke(link.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
                <Plus className="size-3.5" />
                New group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New schedule group</DialogTitle>
                <DialogDescription>Organize friends you compare often.</DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                value={groupName}
                maxLength={60}
                placeholder="Project team"
                onChange={(event) => setGroupName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCreateGroup();
                }}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setGroupOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleCreateGroup()} disabled={!groupName.trim() || pending === 'group'}>
                  {pending === 'group' ? 'Creating…' : 'Create group'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {groups === undefined ? (
        <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
      ) : groups.length > 0 ? (
        <CardGroup orientation="inline" separated proximityHover className="gap-1.5">
          {groups.map((group) => (
            <Card
              key={group.id}
              href={`/schedule/groups/${group.id}`}
              label={`Open ${group.name}`}
              className="min-h-12 px-3 py-2"
            >
              <CardContent className="flex min-w-0 items-center gap-2 p-0">
                <Users className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {group.memberCount}
                </span>
              </CardContent>
            </Card>
          ))}
        </CardGroup>
      ) : (
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted-foreground shadow-surface-1">
          Create a group to compare a team at a glance.
        </p>
      )}
    </div>
  );
}

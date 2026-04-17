'use client';

import { use, useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Search, UserMinus, UserPlus } from 'lucide-react';
import type { ClubDetail, ClubDirectoryEntry } from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { SetRoleDialog } from '@/components/clubs/dialogs/set-role-dialog';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clubsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function ClubPeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<ClubDirectoryEntry | null>(null);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.removeMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      toast({ title: 'Member removed' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });

  const isSponsor = club?.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canManage = isSponsor || isAdmin;
  const myMembership = club?.members?.find((member) => member.userId === user?.id);
  const canInvite = canManage || !!myMembership?.role;

  const directory = club?.directory ?? [];
  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return directory;
    return directory.filter((person) =>
      [fullName(person), person.uniqueId, person.kind, person.clubRole]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [deferredSearch, directory]);

  const sponsors = filtered.filter((p) => p.kind === 'SPONSOR');
  const members = filtered.filter((p) => p.kind === 'MEMBER');

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">People</h1>
      <p className="truncate text-xs text-muted-foreground">
        {directory.length} {directory.length === 1 ? 'person' : 'people'}
      </p>
    </div>
  );

  const actions = canInvite ? (
    <Button size="sm" onClick={() => setInviteOpen(true)}>
      <UserPlus className="mr-1.5 size-4" />
      Invite
    </Button>
  ) : null;

  return (
    <ClubWorkspace clubId={id} title={title} actions={actions}>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roster"
            className="h-9 pl-8"
          />
        </div>

        {sponsors.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sponsors
              </h2>
              <span className="text-xs text-muted-foreground">{sponsors.length}</span>
            </div>
            <div className="divide-y rounded-lg border bg-card">
              {sponsors.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  isCurrentUser={person.id === user?.id}
                  canManage={false}
                  onSetRole={() => undefined}
                  onRemove={() => undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members
            </h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>
          {members.length > 0 ? (
            <div className="divide-y rounded-lg border bg-card">
              {members.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  isCurrentUser={person.id === user?.id}
                  canManage={canManage}
                  onSetRole={setRoleTarget}
                  onRemove={(memberId) => removeMutation.mutate(memberId)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              No members match this search.
            </div>
          )}
        </section>
      </div>

      <InviteDialog clubId={id} open={inviteOpen} onOpenChange={setInviteOpen} />
      <SetRoleDialog clubId={id} person={roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)} />
    </ClubWorkspace>
  );
}

function PersonRow({
  person,
  isCurrentUser,
  canManage,
  onSetRole,
  onRemove,
}: {
  person: ClubDirectoryEntry;
  isCurrentUser: boolean;
  canManage: boolean;
  onSetRole: (person: ClubDirectoryEntry) => void;
  onRemove: (memberId: string) => void;
}) {
  const showManage = canManage && person.kind === 'MEMBER' && !isCurrentUser;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <ClubAvatar person={person} className="size-9" fallbackClassName="text-[11px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{fullName(person)}</p>
          {person.clubRole ? (
            <Badge variant="secondary" className="gap-1">
              <Crown className="size-3" />
              {formatClubRole(person.clubRole)}
            </Badge>
          ) : null}
          {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
        </div>
        {person.uniqueId ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{person.uniqueId}</p>
        ) : null}
      </div>
      {showManage ? (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onSetRole(person)}>
            <Crown className="mr-1.5 size-3.5" />
            Role
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(person.id)}
          >
            <UserMinus className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

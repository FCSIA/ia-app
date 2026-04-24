'use client';

import { use, useDeferredValue, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Sparkles, UserMinus, UserPlus, Users, ShieldCheck, Settings } from 'lucide-react';
import type { ClubDetail, ClubDirectoryEntry } from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { InviteDialog } from '@/components/clubs/dialogs/invite-dialog';
import { SetRoleDialog } from '@/components/clubs/dialogs/set-role-dialog';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchInput } from '@/components/ui/search';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

function ManageJoinCodePopover({ club }: { club: ClubDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => clubsApi.generateJoinCode(club.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', club.id] });
      toast({ title: 'Join code generated' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to generate code',
        variant: 'destructive',
      }),
  });

  if (!club.viewer.canManageMembership) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="size-4" />
          Join code
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4 shadow-xl">
        <div className="space-y-1">
          <h4 className="font-medium leading-none">Join code</h4>
          <p className="text-sm text-muted-foreground">
            Generate a reusable code for students to enter directly.
          </p>
        </div>
        {club.activeJoinCode?.code ? (
          <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Active code
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-[0.32em] text-foreground">
              {club.activeJoinCode.code}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Generated{' '}
              {club.activeJoinCode.updatedAt
                ? formatDistanceToNow(new Date(club.activeJoinCode.updatedAt), { addSuffix: true })
                : 'recently'}
            </p>
          </div>
        ) : null}
        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="w-full">
          <Sparkles className="mr-2 size-4" />
          {club.activeJoinCode?.code ? 'Regenerate code' : 'Generate code'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function ClubPeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<ClubDirectoryEntry | null>(null);

  const [filter, setFilter] = useState('all');

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

  const canManage = !!club?.viewer.canManageMembership;
  const isStaff = !!user && hasRole(user, 'TEACHER', 'SUPPORT_STAFF', 'ADMIN', 'SUPER_ADMIN');
  const canInvite = canManage || isStaff;

  const directory = club?.directory ?? [];
  
  const stats = useMemo(() => {
    return {
      all: directory.length,
      sponsors: directory.filter(p => p.kind === 'SPONSOR').length,
      leaders: directory.filter(p => !!p.clubRole).length,
      members: directory.filter(p => p.kind === 'MEMBER' && !p.clubRole).length,
    };
  }, [directory]);

  const filtered = useMemo(() => {
    let result = filterBySearchQuery(directory, deferredSearch, (person) => [
      fullName(person),
      person.uniqueId,
      person.kind,
      person.clubRole,
    ]);

    if (filter === 'sponsors') result = result.filter(p => p.kind === 'SPONSOR');
    else if (filter === 'leaders') result = result.filter(p => !!p.clubRole);
    else if (filter === 'members') result = result.filter(p => p.kind === 'MEMBER' && !p.clubRole);

    return result;
  }, [deferredSearch, directory, filter]);

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">People</h1>
      <p className="truncate text-xs text-muted-foreground">
        {stats.all} {stats.all === 1 ? 'person' : 'people'} in this club
      </p>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-2">
      {club && canManage ? <ManageJoinCodePopover club={club} /> : null}
      {canInvite ? (
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1.5 size-4" />
          Invite member
        </Button>
      ) : null}
    </div>
  );

  return (
    <ClubWorkspace clubId={id} title={title} actions={actions}>
      <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex rounded-xl p-1 bg-muted/50 border border-border/50">
                <TabsTrigger value="all" className="rounded-lg text-xs sm:text-sm">
                  All <span className="ml-1.5 opacity-50">{stats.all}</span>
                </TabsTrigger>
                <TabsTrigger value="leaders" className="rounded-lg text-xs sm:text-sm">
                  Leaders <span className="ml-1.5 opacity-50">{stats.leaders}</span>
                </TabsTrigger>
                <TabsTrigger value="sponsors" className="rounded-lg text-xs sm:text-sm">
                  Sponsors <span className="ml-1.5 opacity-50">{stats.sponsors}</span>
                </TabsTrigger>
                <TabsTrigger value="members" className="rounded-lg text-xs sm:text-sm">
                  Members <span className="ml-1.5 opacity-50">{stats.members}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search roster..."
              className="w-full sm:w-[280px] rounded-xl bg-muted/30"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
            {filtered.length > 0 ? (
              <div className="divide-y divide-border/60">
                {filtered.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    isCurrentUser={person.id === user?.id}
                    canManage={canManage && person.kind === 'MEMBER'}
                    onSetRole={setRoleTarget}
                    onRemove={(memberId) => removeMutation.mutate(memberId)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Users className="size-8 text-primary/60" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No people found</h3>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-[250px]">
                  {deferredSearch 
                    ? "We couldn't find anyone matching your search." 
                    : "There are no members in this category yet."}
                </p>
                {deferredSearch && (
                  <Button variant="link" onClick={() => setSearch('')} className="mt-2 text-primary font-semibold">
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
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
  const isSponsor = person.kind === 'SPONSOR';

  return (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30 group">
      <ClubAvatar person={person} className="size-10 shadow-sm" fallbackClassName="text-[12px]" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{fullName(person)}</p>
          {isSponsor ? (
            <Badge variant="default" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-1 px-1.5 py-0 h-5">
               <ShieldCheck className="size-3" />
               Sponsor
            </Badge>
          ) : person.clubRole ? (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 h-5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crown className="size-3 text-amber-500" />
              {formatClubRole(person.clubRole)}
            </Badge>
          ) : null}
          {isCurrentUser ? <Badge variant="outline" className="px-1.5 py-0 h-5 text-[10px] uppercase tracking-widest text-muted-foreground">You</Badge> : null}
        </div>
        {person.uniqueId ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">{person.uniqueId}</p>
        ) : null}
      </div>
      {showManage ? (
        <div className="flex gap-2 opacity-100 sm:opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="secondary" className="h-8 gap-1.5" onClick={() => onSetRole(person)}>
            <Settings className="size-3.5" />
            <span className="hidden sm:inline">Role</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
            onClick={() => onRemove(person.id)}
          >
            <UserMinus className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

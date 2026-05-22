'use client';

import { use, useDeferredValue, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery as useRestQuery, useQueryClient } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import {
  Crown,
  Copy,
  QrCode,
  Send,
  Sparkles,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  ShieldCheck,
  Settings,
  X,
} from 'lucide-react';
import type { ClubDetail, ClubDirectoryEntry } from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { SetRoleDialog } from '@/components/clubs/dialogs/set-role-dialog';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { api } from '~/apps/convex/src/_generated/api';
import { clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

type StudentResult = { id: string; uniqueId: string; firstName: string; lastName: string };

function ManagePeopleDialog({
  club,
  open,
  onOpenChange,
}: {
  club: ClubDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvKey, setCsvKey] = useState(0);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);

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

  const searchResults =
    useQuery(
      api.schedule.searchPeople,
      deferredQuery.length >= 2 && !selected
        ? { query: deferredQuery, limit: 20 }
        : 'skip',
    ) ?? [];
  const isSearching = deferredQuery.length >= 2 && !selected && searchResults.length === 0;

  const inviteMutation = useMutation({
    mutationFn: (uniqueId: string) => clubsApi.sendInvite(club.id, uniqueId),
    onSuccess: () => {
      setSelected(null);
      setQuery('');
      toast({ title: 'Invite sent' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to send invite',
        variant: 'destructive',
      }),
  });

  const csvMutation = useMutation({
    mutationFn: () => {
      if (!csvFile) throw new Error('CSV required');
      return clubsApi.bulkInviteCsv(club.id, csvFile);
    },
    onSuccess: (response) => {
      setResult(response.data);
      setCsvFile(null);
      setCsvKey((key) => key + 1);
      toast({
        title: 'CSV processed',
        description: `${response.data.invited} invited, ${response.data.skipped} skipped`,
      });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to import CSV',
        variant: 'destructive',
      }),
  });

  const joinUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/clubs/${club.id}?joinCode=${club.activeJoinCode?.code ?? ''}`;
  const qrUrl = club.activeJoinCode?.code
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Choose the fastest way to bring students into this club.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="qr" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabItem value="qr" label="Qr">
              <QrCode className="size-4" />
            </TabItem>
            <TabItem value="code" label="Code">
              <Sparkles className="size-4" />
            </TabItem>
            <TabItem value="single" label="Single">
              <UserPlus className="size-4" />
            </TabItem>
            <TabItem value="bulk" label="Bulk">
              <Upload className="size-4" />
            </TabItem>
          </TabsList>

          <TabPanel value="qr" className="mt-4">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-5 text-center">
              {qrUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="Club join QR code" className="size-56 rounded-md border bg-white p-2" />
                  <Button type="button" variant="tertiary" onClick={() => navigator.clipboard?.writeText(joinUrl)}>
                    <Copy className="mr-2 size-4" />
                    Copy link
                  </Button>
                </>
              ) : (
                <>
                  <QrCode className="size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Generate a join code first to create a QR link.
                  </p>
                  <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                    Generate join code
                  </Button>
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel value="code" className="mt-4">
            <div className="flex flex-col gap-4 rounded-lg border p-5">
              {club.activeJoinCode?.code ? (
                <div className="rounded-lg bg-muted/40 p-4 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Active code
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-[0.32em]">
                    {club.activeJoinCode.code}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generated{' '}
                    {club.activeJoinCode.updatedAt
                      ? formatDistanceToNow(new Date(club.activeJoinCode.updatedAt), { addSuffix: true })
                      : 'recently'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active join code yet.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {club.activeJoinCode?.code ? (
                  <Button
                    type="button"
                    variant="tertiary"
                    onClick={() => navigator.clipboard?.writeText(club.activeJoinCode?.code ?? '')}
                  >
                    <Copy className="mr-2 size-4" />
                    Copy code
                  </Button>
                ) : null}
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  {club.activeJoinCode?.code ? 'Regenerate code' : 'Generate code'}
                </Button>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="single" className="mt-4">
            <div className="flex flex-col gap-3">
              {selected ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {selected.firstName[0]}{selected.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fullName(selected)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{selected.uniqueId}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSelected(null); setQuery(''); }}>
                    <X className="size-4" />
                  </Button>
                  <Button size="sm" disabled={inviteMutation.isPending} onClick={() => inviteMutation.mutate(selected.uniqueId)}>
                    <Send className="mr-1.5 size-4" />
                    Send
                  </Button>
                </div>
              ) : (
                <Command className="rounded-lg border" shouldFilter={false}>
                  <CommandInput placeholder="Search by name or student ID..." value={query} onValueChange={setQuery} />
                  <CommandList className="max-h-[220px]">
                    {deferredQuery.length < 2 ? (
                      <div className="py-5 text-center text-sm text-muted-foreground">
                        Type at least 2 characters to search.
                      </div>
                    ) : isSearching ? (
                      <div className="py-5 text-center text-sm text-muted-foreground">Searching...</div>
                    ) : searchResults?.length === 0 ? (
                      <CommandEmpty>No students found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Results">
                        {searchResults?.map((student) => (
                          <CommandItem
                            key={student.id}
                            onSelect={() => setSelected(student)}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {student.firstName[0]}{student.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{fullName(student)}</p>
                              <p className="font-mono text-xs text-muted-foreground">{student.uniqueId}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              )}
            </div>
          </TabPanel>

          <TabPanel value="bulk" className="mt-4">
            <div className="flex flex-col gap-3 rounded-lg border p-5">
              <Label htmlFor="invite-csv">CSV upload</Label>
              <Input
                key={csvKey}
                id="invite-csv"
                type="file"
                accept=".csv"
                onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
              />
              <Button
                variant="tertiary"
                disabled={!csvFile || csvMutation.isPending}
                onClick={() => csvMutation.mutate()}
              >
                <Upload className="mr-2 size-4" />
                {csvMutation.isPending ? 'Uploading...' : 'Upload CSV'}
              </Button>
              {result ? (
                <div className="rounded-md bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {result.invited} invited · {result.skipped} skipped
                  </p>
                  {result.errors.slice(0, 5).map((error) => (
                    <p key={error} className="mt-1 text-xs text-muted-foreground">
                      {error}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function ClubPeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [manageOpen, setManageOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<ClubDirectoryEntry | null>(null);

  const [filter, setFilter] = useState('all');

  const { data: club } = useRestQuery<ClubDetail>({
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

  return (
    <ClubWorkspace clubId={id} title={title}>
      <div className="mx-auto w-full max-w-4xl space-y-8 p-6">

        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-4 rounded-3xl bg-muted p-1 sm:w-auto sm:inline-flex">
                <TabItem value="all" className="rounded-lg text-xs sm:text-sm" label="All">
                  All <span className="ml-1.5 opacity-50">{stats.all}</span>
                </TabItem>
                <TabItem value="leaders" className="rounded-lg text-xs sm:text-sm" label="Leaders">
                  Leaders <span className="ml-1.5 opacity-50">{stats.leaders}</span>
                </TabItem>
                <TabItem value="sponsors" className="rounded-lg text-xs sm:text-sm" label="Sponsors">
                  Sponsors <span className="ml-1.5 opacity-50">{stats.sponsors}</span>
                </TabItem>
                <TabItem value="members" className="rounded-lg text-xs sm:text-sm" label="Members">
                  Members <span className="ml-1.5 opacity-50">{stats.members}</span>
                </TabItem>
              </TabsList>
            </Tabs>

            <div className="flex w-full justify-end gap-2 sm:w-auto">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search roster..."
                className="w-full sm:w-[280px]"
              />
              {club && canInvite ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => setManageOpen(true)}
                  aria-label="Add members"
                  title="Add members"
                >
                  <UserPlus className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
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
                  <Button variant="ghost" onClick={() => setSearch('')} className="mt-2 text-primary font-semibold">
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {club ? (
        <ManagePeopleDialog club={club} open={manageOpen} onOpenChange={setManageOpen} />
      ) : null}
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
            <Badge variant="solid" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-1 px-1.5 py-0 h-5">
               <ShieldCheck className="size-3" />
               Sponsor
            </Badge>
          ) : person.clubRole ? (
            <Badge variant="solid" className="gap-1 px-1.5 py-0 h-5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crown className="size-3 text-amber-500" />
              {formatClubRole(person.clubRole)}
            </Badge>
          ) : null}
          {isCurrentUser ? <Badge variant="dot" className="px-1.5 py-0 h-5 text-[10px] uppercase tracking-widest text-muted-foreground">You</Badge> : null}
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

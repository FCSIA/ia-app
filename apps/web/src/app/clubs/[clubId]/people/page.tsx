'use client';

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Check,
  QrCode,
  Send,
  Sparkles,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useClubId } from '../../club-route';
import type { ClubDetail, ClubDirectoryEntry } from '@/components/clubs/types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { SetRoleDialog } from '@/components/clubs/dialogs/set-role-dialog';
import { fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { InputCopy } from '@/components/ui/input-copy';
import { Label } from '@/components/ui/label';
import { SearchInput } from '@/components/ui/search';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { api } from '~/apps/convex/src/_generated/api';
import { parseInviteCsv } from '@/lib/parse-invite-csv';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';

type StudentResult = FunctionReturnType<typeof api.clubs.invitations.searchInviteCandidates>[number];

const subscribeToOrigin = () => () => undefined;
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => '';

function ManagePeopleDialog({
  club,
  open,
  onOpenChange,
}: {
  club: ClubDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvKey, setCsvKey] = useState(0);
  const [result, setResult] = useState<{ invited: number; skipped: number; errors: string[] } | null>(null);
  const origin = useSyncExternalStore(subscribeToOrigin, getClientOrigin, getServerOrigin);

  const generateJoinCode = useMutation(api.clubs.invitations.generateJoinCode);

  const searchResults =
    useQuery(
      api.clubs.invitations.searchInviteCandidates,
      deferredQuery.length >= 2 && !selected
        ? { clubId, query: deferredQuery, limit: 20 }
        : 'skip',
    ) ?? [];
  const isSearching = deferredQuery.length >= 2 && !selected && searchResults.length === 0;

  const sendInvite = useMutation(api.clubs.invitations.sendInvite);
  const bulkInvite = useMutation(api.clubs.invitations.bulkInvite);
  const [csvPending, setCsvPending] = useState(false);

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setCsvPending(true);
    try {
      const uniqueIds = parseInviteCsv(await csvFile.text());
      const response = await bulkInvite({ clubId, uniqueIds });
      setResult(response);
      setCsvFile(null);
      setCsvKey((key) => key + 1);
      toast({
        title: 'CSV processed',
        description: `${response.invited} invited, ${response.skipped} skipped`,
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to import CSV',
        variant: 'destructive',
      });
    } finally {
      setCsvPending(false);
    }
  };

  const joinUrl = origin && club.activeJoinCode?.code
    ? `${origin}/clubs/${club._id}?joinCode=${club.activeJoinCode.code}`
    : '';
  const qrUrl = joinUrl
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
          <TabsList>
            <TabItem value="qr" label="QR" icon={QrCode} />
            <TabItem value="code" label="Code" icon={Sparkles} />
            <TabItem value="single" label="Single" icon={UserPlus} />
            <TabItem value="bulk" label="Bulk" icon={Upload} />
          </TabsList>

          <TabPanel value="qr" className="mt-4">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-5 text-center">
              {qrUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="Club join QR code" className="size-56 rounded-md border bg-white p-2" />
                  <InputCopy
                    value={joinUrl}
                    variant="button"
                    className="w-full max-w-sm"
                  />
                </>
              ) : (
                <>
                  <QrCode className="size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Generate a join code first to create a QR link.
                  </p>
                  <Button
                    onClick={() =>
                      void generateJoinCode({ clubId }).then(() =>
                        toast({ title: 'Join code generated' }),
                      )
                    }
                  >
                    Generate join code
                  </Button>
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel value="code" className="mt-4">
            <div className="flex flex-col gap-4 rounded-lg border p-5">
              {club.activeJoinCode?.code ? (
                <div className="rounded-lg bg-muted/40 p-3">
                  <InputCopy
                    value={club.activeJoinCode.code}
                    label="Active code"
                    variant="button"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
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
                <Button
                  onClick={() =>
                    void generateJoinCode({ clubId }).then(() =>
                      toast({ title: 'Join code generated' }),
                    )
                  }
                >
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
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSelected(null); setQuery(''); }}>
                    <X className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    leadingIcon={Send}
                    onClick={() =>
                      void sendInvite({ clubId, recipientUniqueId: selected.uniqueId }).then(() => {
                        setSelected(null);
                        setQuery('');
                        toast({ title: 'Invite sent' });
                      })
                    }
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <Command className="rounded-lg border" shouldFilter={false}>
                  <CommandInput placeholder="Search by name..." value={query} onValueChange={setQuery} />
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
                            key={student._id}
                            onSelect={() => setSelected(student)}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {student.firstName[0]}{student.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{fullName(student)}</p>
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
                leadingIcon={Upload}
                disabled={!csvFile || csvPending}
                onClick={() => void handleCsvUpload()}
              >
                {csvPending ? 'Uploading...' : 'Upload CSV'}
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

export default function ClubPeoplePage() {
  const clubId = useClubId();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [manageOpen, setManageOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClubDirectoryEntry | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [requestInFlight, setRequestInFlight] = useState<string | null>(null);

  const [filter, setFilter] = useState(() =>
    searchParams?.get('tab') === 'requests' ? 'requests' : 'all',
  );

  useEffect(() => {
    if (searchParams?.get('tab') === 'requests') setFilter('requests');
  }, [searchParams]);

  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const removeMember = useMutation(api.clubs.management.removeMember);
  const respondToJoinRequest = useMutation(api.clubs.invitations.respondToJoinRequest);
  const initializeRoles = useMutation(api.clubs.management.initializeRoles);

  const canAssignRoles = !!club?.viewer.permissions.assignRoles;
  const canRemoveMembers = !!club?.viewer.permissions.removeMembers;
  const canApproveRequests = !!club?.viewer.permissions.manageJoinRequests;
  const canInvite = !!club?.viewer.permissions.inviteMembers;

  useEffect(() => {
    if (canAssignRoles && club?.roles.length === 0) {
      void initializeRoles({ clubId }).catch((error) => {
        toast({
          title: error instanceof Error ? error.message : 'Could not initialize roles',
          variant: 'destructive',
        });
      });
    }
  }, [canAssignRoles, club?.roles.length, clubId, initializeRoles, toast]);

  const directory = club?.directory ?? [];
  const pendingJoinRequests = club?.pendingJoinRequests ?? [];
  const visibleFilter = filter === 'requests' && !canApproveRequests ? 'all' : filter;

  const stats = useMemo(() => {
    return {
      all: directory.length,
      sponsors: directory.filter(p => p.kind === 'SPONSOR').length,
      roleCounts: new Map(club?.roles.map((role) => [
        role._id,
        directory.filter((person) => person.roleId === role._id).length,
      ])),
    };
  }, [club?.roles, directory]);

  const filtered = useMemo(() => {
    let result = filterBySearchQuery(directory, deferredSearch, (person) => [
      fullName(person),
      person.uniqueId,
      person.kind,
      person.roleName,
    ]);

    if (visibleFilter === 'sponsors') result = result.filter(p => p.kind === 'SPONSOR');
    else if (visibleFilter.startsWith('role:')) {
      result = result.filter((person) => person.roleId === visibleFilter.slice(5));
    }

    return result;
  }, [deferredSearch, directory, visibleFilter]);

  async function respondToRequest(requestId: Id<'clubJoinRequests'>, accept: boolean) {
    setRequestInFlight(requestId);
    try {
      await respondToJoinRequest({ clubId, requestId, accept });
      toast({ title: accept ? 'Join request approved' : 'Join request declined' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to update join request',
        variant: 'destructive',
      });
    } finally {
      setRequestInFlight(null);
    }
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeMember({ clubId, memberId: removeTarget._id });
      toast({ title: `${fullName(removeTarget)} removed` });
      setRemoveTarget(null);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to remove member',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  }

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">People</h1>
      <p className="truncate text-xs text-muted-foreground">
        {stats.all} {stats.all === 1 ? 'person' : 'people'} in this club
      </p>
    </div>
  );

  return (
    <ClubWorkspace title={title} contentClassName="flex flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-3 sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={visibleFilter} onValueChange={setFilter} className="min-w-0 sm:w-auto">
              <div className="min-w-0 overflow-x-auto pb-1">
                <TabsList>
                  <TabItem value="all" label={`All ${stats.all}`} />
                  {club?.roles.map((role) => (
                    <TabItem
                      key={role._id}
                      value={`role:${role._id}`}
                      label={`${role.name} ${stats.roleCounts.get(role._id) ?? 0}`}
                    />
                  ))}
                  <TabItem value="sponsors" label={`Sponsors ${stats.sponsors}`} />
                  {canApproveRequests ? (
                    <TabItem
                      value="requests"
                      label={`Requests ${pendingJoinRequests.length}`}
                    />
                  ) : null}
                </TabsList>
              </div>
            </Tabs>

            <div className="flex w-full justify-end gap-2 sm:w-auto">
              {visibleFilter !== 'requests' ? (
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search people"
                  size="sm"
                  className="w-full sm:w-64"
                />
              ) : null}
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

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
            {visibleFilter === 'requests' ? (
              pendingJoinRequests.length > 0 ? (
                <ScrollArea
                  className="min-h-0 flex-1"
                >
                  <div className="divide-y divide-border/60">
                    {pendingJoinRequests.map((request) => {
                      const processing = requestInFlight === request._id;
                      return (
                        <div key={request._id} className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {fullName(request.requester)}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              Requested {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="tertiary"
                              disabled={requestInFlight !== null}
                              onClick={() => void respondToRequest(request._id, false)}
                            >
                              Decline
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              leadingIcon={Check}
                              disabled={requestInFlight !== null}
                              onClick={() => void respondToRequest(request._id, true)}
                            >
                              {processing ? 'Updating…' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  No join requests are waiting for review.
                </div>
              )
            ) : filtered.length > 0 ? (
              <ScrollArea
                className="min-h-0 flex-1"
              >
                <div className="divide-y divide-border/60">
                  {filtered.map((person) => (
                    <PersonRow
                      key={person._id}
                      person={person}
                      isCurrentUser={person._id === user?._id}
                      canAssignRole={canAssignRoles && person.kind === 'MEMBER'}
                      canRemove={canRemoveMembers && person.kind === 'MEMBER'}
                      onRemove={setRemoveTarget}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                <Users className="mb-2 size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">No people found</h3>
                <p className="mt-1 max-w-64 text-xs text-muted-foreground">
                  {deferredSearch
                    ? 'Try a different search.'
                    : 'No one is in this group yet.'}
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
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isRemoving) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeTarget ? fullName(removeTarget) : 'member'} from {club?.name ?? 'this club'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this club and its channels. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Keep member</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
              onClick={(event) => {
                event.preventDefault();
                void confirmRemoveMember();
              }}
            >
              {isRemoving ? 'Removing…' : 'Remove from club'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClubWorkspace>
  );
}

function PersonRow({
  person,
  isCurrentUser,
  canAssignRole,
  canRemove,
  onRemove,
}: {
  person: ClubDirectoryEntry;
  isCurrentUser: boolean;
  canAssignRole: boolean;
  canRemove: boolean;
  onRemove: (person: ClubDirectoryEntry) => void;
}) {
  const showManage = (canAssignRole || canRemove) && person.kind === 'MEMBER' && !isCurrentUser;
  const isSponsor = person.kind === 'SPONSOR';

  return (
    <div className="group flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-hover">
      <ClubAvatar person={person} className="size-9" fallbackClassName="text-[11px]" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{fullName(person)}</p>
          {isSponsor ? (
            <Badge variant="solid" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-1 px-1.5 py-0 h-5">
               <ShieldCheck className="size-3" />
               Sponsor
            </Badge>
          ) : person.roleName ? (
            <Badge variant="solid" className="px-1.5 py-0 h-5 border-border/70 bg-muted/60 text-muted-foreground">
              {person.roleName}
            </Badge>
          ) : null}
          {isCurrentUser ? <Badge variant="solid" className="px-1.5 py-0 h-5 text-[10px] uppercase tracking-widest text-muted-foreground">You</Badge> : null}
        </div>
      </div>
      {showManage ? (
        <div className="flex shrink-0 items-center gap-1">
          {canAssignRole ? <SetRoleDialog person={person} /> : null}
          {canRemove ? <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove ${fullName(person)} from club`}
            onClick={() => onRemove(person)}
          >
            <UserMinus className="size-4" />
          </Button> : null}
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { use, useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AtSign,
  Crown,
  Hash,
  Lock,
  Megaphone,
  Search,
  Shield,
  Upload,
  UserMinus,
  UserPlus,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { PeoplePicker } from '@/components/clubs/people-picker';
import {
  AnnouncementSummary,
  ClubDetail,
  ClubDirectoryEntry,
  ClubTag,
  formatClubRole,
  fullName,
} from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getUser, hasRole } from '@/lib/auth';
import { announcementsApi, clubsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type TabKey = 'overview' | 'people' | 'tags';
type BulkInviteResult = { invited: number; skipped: number; errors: string[] };

function DirectoryCard({
  person,
  canManageMembers,
  currentUserId,
  isSponsor,
  onPromote,
  onRemove,
}: {
  person: ClubDirectoryEntry;
  canManageMembers: boolean;
  currentUserId?: string;
  isSponsor: boolean;
  onPromote: (personId: string) => void;
  onRemove: (personId: string) => void;
}) {
  const isCurrentUser = person.id === currentUserId;

  return (
    <Card className="rounded-3xl border-border/70 bg-background/90">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <ClubAvatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{fullName(person)}</p>
            {person.kind === 'SPONSOR' ? (
              <Badge variant="secondary" className="rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300">
                Sponsor
              </Badge>
            ) : null}
            {person.clubRole === 'LEADER' ? (
              <Badge variant="secondary" className="rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <Crown className="mr-1 size-3" />
                Leader
              </Badge>
            ) : null}
            {isCurrentUser ? <Badge variant="outline" className="rounded-full">You</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {person.uniqueId ? <span className="font-mono">{person.uniqueId}</span> : null}
            {person.kind === 'MEMBER' && person.clubRole ? (
              <span>{formatClubRole(person.clubRole)}</span>
            ) : null}
          </div>
        </div>
        {canManageMembers && person.kind === 'MEMBER' && !isCurrentUser ? (
          <div className="flex gap-2">
            {person.clubRole === 'MEMBER' && isSponsor ? (
              <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => onPromote(person.id)}>
                <Crown className="mr-1.5 size-4" />
                Promote
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl text-destructive hover:text-destructive"
              onClick={() => onRemove(person.id)}
            >
              <UserMinus className="mr-1.5 size-4" />
              Remove
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('overview');
  const [directorySearch, setDirectorySearch] = useState('');
  const deferredDirectorySearch = useDeferredValue(directorySearch);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const [inviteId, setInviteId] = useState('');
  const [inviteCsvFile, setInviteCsvFile] = useState<File | null>(null);
  const [inviteCsvInputKey, setInviteCsvInputKey] = useState(0);
  const [bulkInviteResult, setBulkInviteResult] = useState<BulkInviteResult | null>(null);
  const [postForm, setPostForm] = useState({ title: '', body: '', allowComments: false });
  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    isPrivate: false,
    memberIds: [] as string[],
  });
  const [tagForm, setTagForm] = useState({
    name: '',
    memberIds: [] as string[],
  });

  const { data: club, isLoading } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((response) => response.data),
  });

  const { data: announcements = [] } = useQuery<AnnouncementSummary[]>({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((response) => response.data),
    enabled: !!club,
  });

  const inviteMutation = useMutation({
    mutationFn: (uniqueId: string) => clubsApi.sendInvite(id, uniqueId),
    onSuccess: () => {
      setInviteOpen(false);
      setInviteId('');
      toast({ title: 'Invite sent' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to invite member',
        variant: 'destructive',
      });
    },
  });

  const bulkInviteMutation = useMutation({
    mutationFn: () => {
      if (!inviteCsvFile) throw new Error('CSV file is required');
      return clubsApi.bulkInviteCsv(id, inviteCsvFile);
    },
    onSuccess: (response) => {
      setBulkInviteResult(response.data);
      setInviteCsvFile(null);
      setInviteCsvInputKey((current) => current + 1);
      toast({
        title: 'Bulk invites processed',
        description: `${response.data.invited} invited, ${response.data.skipped} skipped`,
      });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to import invites',
        variant: 'destructive',
      });
    },
  });

  const postMutation = useMutation({
    mutationFn: () =>
      announcementsApi.create({
        ...postForm,
        title: postForm.title.trim(),
        body: postForm.body.trim(),
        targetType: 'CLUB',
        clubId: id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-announcements', id] });
      setPostOpen(false);
      setPostForm({ title: '', body: '', allowComments: false });
      toast({ title: 'Announcement posted' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to post announcement',
        variant: 'destructive',
      });
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: () =>
      clubsApi.createChannel(id, {
        name: channelForm.name.trim(),
        description: channelForm.description.trim() || undefined,
        isPrivate: channelForm.isPrivate,
        memberIds: channelForm.memberIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      setChannelOpen(false);
      setChannelForm({ name: '', description: '', isPrivate: false, memberIds: [] });
      toast({ title: 'Channel created' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create channel',
        variant: 'destructive',
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: () =>
      clubsApi.createTag(id, {
        name: tagForm.name.trim(),
        memberIds: tagForm.memberIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      setTagOpen(false);
      setTagForm({ name: '', memberIds: [] });
      toast({ title: 'Mention tag created' });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to create tag',
        variant: 'destructive',
      });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.promoteMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      toast({ title: 'Member promoted to leader' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.removeMember(id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      toast({ title: 'Member removed' });
    },
  });

  const directory = club?.directory ?? [];
  const memberOptions = useMemo(
    () => directory.filter((person) => person.kind === 'MEMBER'),
    [directory],
  );

  const filteredDirectory = useMemo(() => {
    const search = deferredDirectorySearch.trim().toLowerCase();
    if (!search) return directory;

    return directory.filter((person) =>
      [
        fullName(person),
        person.uniqueId,
        person.kind,
        person.clubRole,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }, [deferredDirectorySearch, directory]);

  const sponsorDirectory = filteredDirectory.filter((person) => person.kind === 'SPONSOR');
  const memberDirectory = filteredDirectory.filter((person) => person.kind === 'MEMBER');

  if (isLoading) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">Loading club workspace…</div>
      </AppShell>
    );
  }

  if (!club) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">Club not found or access denied.</div>
      </AppShell>
    );
  }

  const isSponsor = club.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const myMembership = club.members?.find((member) => member.userId === user?.id);
  const isLeader = myMembership?.role === 'LEADER';
  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canPost = isSponsor || isLeader || isAdmin;
  const canInvite = isSponsor || isLeader || isAdmin;
  const canManageMembers = isSponsor || isAdmin;
  const canManageChannels = isSponsor || isLeader || isAdmin;
  const channels = club.channels ?? [];
  const tags = club.tags ?? [];
  const recentAnnouncements = announcements.slice(0, 4);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_38%),linear-gradient(135deg,rgba(255,247,237,0.94),rgba(255,255,255,0.92))] p-6 shadow-[0_30px_80px_-44px_rgba(234,88,12,0.55)] dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_34%),linear-gradient(135deg,rgba(28,25,23,0.98),rgba(17,17,17,0.96))] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/clubs"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/65 px-4 py-2 text-sm text-foreground/75 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5"
              >
                <ArrowLeft className="size-4" />
                Back to clubs
              </Link>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-orange-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-orange-700 dark:text-orange-200">
                    Club Workspace
                  </Badge>
                  {isSponsor ? (
                    <Badge variant="secondary" className="rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300">
                      Sponsor
                    </Badge>
                  ) : null}
                  {isLeader ? (
                    <Badge variant="secondary" className="rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
                      <Crown className="mr-1 size-3" />
                      Leader
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {club.name}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground/75 sm:text-base">
                    {club.description || 'No description yet. Add one so the club identity and mission are clear.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px] lg:max-w-[420px] lg:flex-1">
              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Members</p>
                  <p className="mt-4 text-3xl font-semibold">{club.members.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Channels</p>
                  <p className="mt-4 text-3xl font-semibold">{channels.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tags</p>
                  <p className="mt-4 text-3xl font-semibold">{tags.length}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <aside className="space-y-6">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Quick actions</CardTitle>
                  <Users2 className="size-4 text-orange-600" />
                </div>
                <CardDescription>Keep membership, posts, and channels moving without leaving this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {canInvite ? (
                  <Button className="w-full rounded-2xl justify-start" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="mr-2 size-4" />
                    Invite members
                  </Button>
                ) : null}
                {canPost ? (
                  <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={() => setPostOpen(true)}>
                    <Megaphone className="mr-2 size-4" />
                    Post announcement
                  </Button>
                ) : null}
                {canManageChannels ? (
                  <>
                    <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={() => setChannelOpen(true)}>
                      <Hash className="mr-2 size-4" />
                      Create channel
                    </Button>
                    <Button variant="outline" className="w-full rounded-2xl justify-start" onClick={() => setTagOpen(true)}>
                      <AtSign className="mr-2 size-4" />
                      Create tag
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl">Channel rail</CardTitle>
                <CardDescription>
                  Sponsors automatically see every channel, including private ones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {channels.length > 0 ? (
                  channels.map((channel) => (
                    <Link key={channel.id} href={`/clubs/${id}/channels/${channel.id}`} className="block">
                      <div className="rounded-3xl border border-border/70 bg-background/80 p-4 transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10">
                        <div className="flex items-center gap-2">
                          {channel.isPrivate ? (
                            <Lock className="size-4 text-muted-foreground" />
                          ) : (
                            <Hash className="size-4 text-muted-foreground" />
                          )}
                          <p className="font-medium text-foreground">{channel.name}</p>
                        </div>
                        {channel.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {channel.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full">
                            {channel.isPrivate ? 'Private' : 'Open'}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {channel._count?.messages ?? 0} messages
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <Empty className="rounded-3xl border-border/70 bg-muted/20">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Hash />
                      </EmptyMedia>
                      <EmptyTitle>No channels yet</EmptyTitle>
                      <EmptyDescription>Start with a general workspace or add a private planning channel.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-6">
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="space-y-6">
              <TabsList className="h-auto w-full justify-start gap-2 rounded-3xl border border-border/70 bg-background/80 p-2">
                <TabsTrigger value="overview" className="rounded-2xl px-4 py-2.5">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="people" className="rounded-2xl px-4 py-2.5">
                  People
                </TabsTrigger>
                <TabsTrigger value="tags" className="rounded-2xl px-4 py-2.5">
                  Tags
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Card className="rounded-[28px] border-border/70">
                  <CardHeader>
                    <CardTitle className="text-2xl">Workspace rhythm</CardTitle>
                    <CardDescription>
                      Announcements carry the official voice. Channels handle ongoing coordination. Tags let leaders ping the right members without memorizing IDs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-orange-500/15 bg-orange-500/[0.06] p-5">
                      <p className="text-sm font-semibold text-foreground">Faculty coverage</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Teacher sponsors remain visible in every channel, public or private, so moderation and supervision do not depend on a manual add.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                      <p className="text-sm font-semibold text-foreground">Member-based tagging</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Custom tags are built from the current club roster. The UI uses member search and selection instead of comma-separated student IDs.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-border/70">
                  <CardHeader>
                    <CardTitle className="text-2xl">Recent announcements</CardTitle>
                    <CardDescription>Club-wide updates, meeting recaps, and sponsor notes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentAnnouncements.length > 0 ? (
                      recentAnnouncements.map((announcement) => (
                        <Link key={announcement.id} href={`/announcements/${announcement.id}`} className="block">
                          <Card className="rounded-3xl border-border/70 bg-background/90 transition hover:-translate-y-0.5 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/10">
                            <CardContent className="space-y-3 p-5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full">
                                  {announcement.allowComments ? 'Comments on' : 'Comments off'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <div>
                                <p className="text-lg font-semibold text-foreground">{announcement.title}</p>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                  {announcement.body}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {announcement.author
                                  ? `${announcement.author.firstName} ${announcement.author.lastName}`
                                  : 'Unknown author'}
                                {announcement._count?.comments
                                  ? ` · ${announcement._count.comments} comments`
                                  : ''}
                              </p>
                            </CardContent>
                          </Card>
                        </Link>
                      ))
                    ) : (
                      <Empty className="rounded-3xl border-border/70 bg-muted/20">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Megaphone />
                          </EmptyMedia>
                          <EmptyTitle>No announcements yet</EmptyTitle>
                          <EmptyDescription>Use announcements for official club updates and sponsor-visible notices.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="people" className="space-y-6">
                <Card className="rounded-[28px] border-border/70">
                  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-2xl">Directory</CardTitle>
                      <CardDescription>
                        Sponsors stay pinned at the top. Members and leaders are searchable by name or unique ID.
                      </CardDescription>
                    </div>
                    <div className="relative w-full max-w-sm">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={directorySearch}
                        onChange={(event) => setDirectorySearch(event.target.value)}
                        placeholder="Search roster"
                        className="rounded-2xl pl-11"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sponsors</h2>
                        <Badge variant="secondary" className="rounded-full">
                          {club.sponsors.length}
                        </Badge>
                      </div>
                      {sponsorDirectory.length > 0 ? (
                        sponsorDirectory.map((person) => (
                          <DirectoryCard
                            key={person.id}
                            person={person}
                            canManageMembers={false}
                            currentUserId={user?.id}
                            isSponsor={isSponsor}
                            onPromote={() => undefined}
                            onRemove={() => undefined}
                          />
                        ))
                      ) : (
                        <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          No sponsors match this search.
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Members</h2>
                        <Badge variant="secondary" className="rounded-full">
                          {club.members.length}
                        </Badge>
                      </div>
                      {memberDirectory.length > 0 ? (
                        <div className="space-y-3">
                          {memberDirectory.map((person) => (
                            <DirectoryCard
                              key={person.id}
                              person={person}
                              canManageMembers={canManageMembers}
                              currentUserId={user?.id}
                              isSponsor={isSponsor}
                              onPromote={(memberId) => promoteMutation.mutate(memberId)}
                              onRemove={(memberId) => removeMutation.mutate(memberId)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          No members match this search.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tags" className="space-y-6">
                <Card className="rounded-[28px] border-border/70">
                  <CardHeader>
                    <CardTitle className="text-2xl">Mention system</CardTitle>
                    <CardDescription>
                      Built-ins cover global audiences. Custom tags let you slice the current club roster into reusable ping groups.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-semibold text-foreground">@all</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Everyone in the visible channel audience.</p>
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-semibold text-foreground">@leaders</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Club leaders who can coordinate or unblock work.</p>
                    </div>
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-semibold text-foreground">@sponsors</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Faculty sponsors with oversight across every channel.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-border/70">
                  <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-2xl">Custom tags</CardTitle>
                      <CardDescription>Tag groups are built from current club members using the selector UI.</CardDescription>
                    </div>
                    {canManageChannels ? (
                      <Button className="rounded-2xl" onClick={() => setTagOpen(true)}>
                        <AtSign className="mr-2 size-4" />
                        Create tag
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tags.length > 0 ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {tags.map((tag: ClubTag) => (
                          <Card key={tag.id} className="rounded-3xl border-border/70 bg-background/90">
                            <CardContent className="space-y-4 p-5">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-200">
                                  @{tag.slug}
                                </Badge>
                                <span className="font-medium text-foreground">{tag.name}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {tag.members.length > 0 ? (
                                  tag.members.map((member) => (
                                    <Badge key={`${tag.id}-${member.user.id}`} variant="secondary" className="rounded-full border border-border/60 bg-muted/40">
                                      {fullName(member.user)}
                                      {member.user.uniqueId ? (
                                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                          {member.user.uniqueId}
                                        </span>
                                      ) : null}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-sm text-muted-foreground">No members selected.</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Empty className="rounded-3xl border-border/70 bg-muted/20">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <AtSign />
                          </EmptyMedia>
                          <EmptyTitle>No custom tags yet</EmptyTitle>
                          <EmptyDescription>
                            Create reusable ping groups like `@officers`, `@build-team`, or `@media`.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>

          <aside className="space-y-6">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-orange-600" />
                  <CardTitle className="text-xl">Faculty visibility</CardTitle>
                </div>
                <CardDescription>
                  Every club must keep at least one teacher sponsor, and sponsors see every channel by design.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {club.sponsors.map((sponsor) => (
                  <div key={sponsor.userId} className="flex items-center gap-3 rounded-3xl border border-border/70 bg-background/80 p-3">
                    <ClubAvatar person={sponsor.user} className="size-9" fallbackClassName="text-[11px]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{fullName(sponsor.user)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {sponsor.user.uniqueId || 'Sponsor'}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/70">
              <CardHeader>
                <CardTitle className="text-xl">Mention quick guide</CardTitle>
                <CardDescription>Use direct `@uniqueId` mentions or built-in tags inside channels.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>`@all` notifies the whole visible audience.</p>
                <p>`@leaders` notifies club leaders.</p>
                <p>`@sponsors` reaches faculty sponsors across any channel.</p>
                <p>Custom tags notify the members currently assigned to that tag.</p>
              </CardContent>
            </Card>

            {bulkInviteResult ? (
              <Card className="rounded-[28px] border-amber-500/20 bg-amber-500/[0.05]">
                <CardHeader>
                  <CardTitle className="text-xl">Last CSV import</CardTitle>
                  <CardDescription>Recent bulk invite status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium text-foreground">
                    Invited {bulkInviteResult.invited}, skipped {bulkInviteResult.skipped}.
                  </p>
                  {bulkInviteResult.errors.slice(0, 5).map((error) => (
                    <p key={error} className="text-muted-foreground">
                      {error}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>

        <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-2xl">Invite members</SheetTitle>
              <SheetDescription className="leading-6">
                Send a single invite by unique ID or upload a CSV with a `unique_id`, `student_id`, or `user_id` column.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="single-invite-id">Single invite</Label>
                <div className="flex gap-2">
                  <Input
                    id="single-invite-id"
                    placeholder="Student or staff unique ID"
                    value={inviteId}
                    onChange={(event) => setInviteId(event.target.value)}
                    className="rounded-2xl"
                  />
                  <Button
                    className="rounded-2xl"
                    disabled={inviteMutation.isPending || !inviteId.trim()}
                    onClick={() => inviteMutation.mutate(inviteId.trim().toUpperCase())}
                  >
                    Send
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-invite-file">Bulk invite CSV</Label>
                <Input
                  key={inviteCsvInputKey}
                  id="bulk-invite-file"
                  type="file"
                  accept=".csv"
                  className="rounded-2xl"
                  onChange={(event) => setInviteCsvFile(event.target.files?.[0] || null)}
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  A single populated column also works if each row only contains one ID.
                </p>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={!inviteCsvFile || bulkInviteMutation.isPending}
                  onClick={() => bulkInviteMutation.mutate()}
                >
                  <Upload className="mr-2 size-4" />
                  {bulkInviteMutation.isPending ? 'Uploading…' : 'Upload CSV'}
                </Button>
              </div>
            </div>

            <SheetFooter className="mt-8">
              <Button variant="outline" className="rounded-2xl" onClick={() => setInviteOpen(false)}>
                Close
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet open={postOpen} onOpenChange={setPostOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-2xl">Post announcement</SheetTitle>
              <SheetDescription className="leading-6">
                Announcements remain the formal channel for club-wide updates and sponsor-visible notices.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="post-title">Title</Label>
                <Input
                  id="post-title"
                  value={postForm.title}
                  onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                  className="rounded-2xl"
                  placeholder="Meeting recap, schedule change, sponsor note..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-body">Body</Label>
                <Textarea
                  id="post-body"
                  value={postForm.body}
                  onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))}
                  rows={8}
                  className="rounded-3xl"
                  placeholder="Write the update..."
                />
              </div>

              <label className="flex items-center gap-3 rounded-3xl border border-border/70 bg-muted/20 p-4">
                <Checkbox
                  checked={postForm.allowComments}
                  onCheckedChange={(checked) =>
                    setPostForm((current) => ({ ...current, allowComments: !!checked }))
                  }
                />
                <span className="text-sm text-foreground">Allow comments on this announcement</span>
              </label>
            </div>

            <SheetFooter className="mt-8 gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setPostOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-2xl"
                disabled={postMutation.isPending || !postForm.title.trim() || !postForm.body.trim()}
                onClick={() => postMutation.mutate()}
              >
                {postMutation.isPending ? 'Posting…' : 'Post announcement'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet open={channelOpen} onOpenChange={setChannelOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-2xl">Create channel</SheetTitle>
              <SheetDescription className="leading-6">
                Public channels are visible to the club. Private channels can target selected members, while sponsors still retain visibility.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel name</Label>
                <Input
                  id="channel-name"
                  value={channelForm.name}
                  onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="announcements, build-team, officers..."
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-description">Description</Label>
                <Textarea
                  id="channel-description"
                  value={channelForm.description}
                  onChange={(event) =>
                    setChannelForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={5}
                  className="rounded-3xl"
                  placeholder="What should this channel be used for?"
                />
              </div>

              <label className="flex items-center gap-3 rounded-3xl border border-border/70 bg-muted/20 p-4">
                <Checkbox
                  checked={channelForm.isPrivate}
                  onCheckedChange={(checked) =>
                    setChannelForm((current) => ({
                      ...current,
                      isPrivate: !!checked,
                      memberIds: checked ? current.memberIds : [],
                    }))
                  }
                />
                <span className="text-sm text-foreground">Private channel</span>
              </label>

              {channelForm.isPrivate ? (
                <div className="space-y-2">
                  <Label>Private audience</Label>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Pick the members who should explicitly belong to this private channel. Sponsors still see the channel automatically.
                  </p>
                  <PeoplePicker
                    people={memberOptions}
                    selectedIds={channelForm.memberIds}
                    onChange={(memberIds) => setChannelForm((current) => ({ ...current, memberIds }))}
                    placeholder="Select members for this channel"
                  />
                </div>
              ) : null}
            </div>

            <SheetFooter className="mt-8 gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setChannelOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-2xl"
                disabled={createChannelMutation.isPending || !channelForm.name.trim()}
                onClick={() => createChannelMutation.mutate()}
              >
                {createChannelMutation.isPending ? 'Creating…' : 'Create channel'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet open={tagOpen} onOpenChange={setTagOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border/70 sm:max-w-2xl">
            <SheetHeader className="space-y-3">
              <SheetTitle className="text-2xl">Create mention tag</SheetTitle>
              <SheetDescription className="leading-6">
                Build reusable tags from the current club member list instead of typing comma-separated student IDs.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Tag name</Label>
                <Input
                  id="tag-name"
                  value={tagForm.name}
                  onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="officers, outreach, social-media..."
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Members in this tag</Label>
                <PeoplePicker
                  people={memberOptions}
                  selectedIds={tagForm.memberIds}
                  onChange={(memberIds) => setTagForm((current) => ({ ...current, memberIds }))}
                  placeholder="Select club members"
                />
              </div>
            </div>

            <SheetFooter className="mt-8 gap-3">
              <Button variant="outline" className="rounded-2xl" onClick={() => setTagOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-2xl"
                disabled={createTagMutation.isPending || !tagForm.name.trim()}
                onClick={() => createTagMutation.mutate()}
              >
                {createTagMutation.isPending ? 'Creating…' : 'Create tag'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

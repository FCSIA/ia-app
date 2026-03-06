'use client';

import { use, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, UserPlus, Crown, UserMinus, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'members' | 'announcements'>('announcements');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [showPost, setShowPost] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', body: '', allowComments: false });

  const { data: club, isLoading } = useQuery({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['club-announcements', id],
    queryFn: () => announcementsApi.getAll(false, id).then((r) => r.data),
    enabled: tab === 'announcements',
  });

  const inviteMutation = useMutation({
    mutationFn: (recipientId: string) => clubsApi.sendInvite(id, recipientId),
    onSuccess: () => { setShowInvite(false); setInviteId(''); toast({ title: 'Invite sent' }); },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to invite', variant: 'destructive' }),
  });

  const promoteMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.promoteMember(id, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', id] }); toast({ title: 'Member promoted to leader' }); },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.removeMember(id, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', id] }); toast({ title: 'Member removed' }); },
  });

  const postMutation = useMutation({
    mutationFn: (d: any) => announcementsApi.create({ ...d, targetType: 'CLUB', clubId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-announcements', id] });
      setShowPost(false);
      setPostForm({ title: '', body: '', allowComments: false });
      toast({ title: 'Posted' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to post', variant: 'destructive' }),
  });

  if (isLoading) return (
    <AppShell><div className="text-center py-16 text-muted-foreground">Loading...</div></AppShell>
  );
  if (!club) return (
    <AppShell><div className="text-center py-16 text-muted-foreground">Club not found or access denied</div></AppShell>
  );

  const isSponsor = club.sponsors?.some((s: any) => s.userId === user?.id);
  const myMember = club.members?.find((m: any) => m.userId === user?.id);
  const isLeader = myMember?.role === 'LEADER';
  const canPost = isSponsor || isLeader || hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canManageMembers = isSponsor || hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clubs">
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{club.name}</h1>
          {isLeader && <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"><Crown size={12} className="mr-1" /> Leader</Badge>}
          {isSponsor && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Sponsor</Badge>}
        </div>
        {club.description && (
          <p className="text-muted-foreground text-sm mb-6 ml-12">{club.description}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-8 ml-12">
          {(canManageMembers || isLeader) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInvite(true)}
            >
              <UserPlus size={14} className="mr-1.5" /> Invite
            </Button>
          )}
          {canPost && (
            <Button
              size="sm"
              onClick={() => setShowPost(true)}
            >
              <Plus size={14} className="mr-1.5" /> Post
            </Button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <Card className="mb-6 ml-12">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Invite by User ID</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Student/Staff unique ID (e.g. STU001)"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value)}
                />
                <Button
                  onClick={() => inviteId.trim() && inviteMutation.mutate(inviteId.trim())}
                  disabled={inviteMutation.isPending}
                >
                  Send Invite
                </Button>
                <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New post form */}
        {showPost && canPost && (
          <Card className="mb-6 ml-12">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">New Club Post</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); postMutation.mutate(postForm); }} className="space-y-4">
                <Input
                  placeholder="Title"
                  value={postForm.title}
                  onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Write your post..."
                  value={postForm.body}
                  onChange={(e) => setPostForm({ ...postForm, body: e.target.value })}
                  rows={4}
                  required
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow-comments"
                    checked={postForm.allowComments}
                    onCheckedChange={(checked) => setPostForm({ ...postForm, allowComments: checked as boolean })}
                  />
                  <Label htmlFor="allow-comments" className="text-sm cursor-pointer">Allow comments</Label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={postMutation.isPending}>Post</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowPost(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b ml-12 mb-6">
          {(['announcements', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-all duration-200 capitalize ${tab === t
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              {t} {t === 'members' && <span className="text-muted-foreground ml-1 font-normal">({club.members?.length || 0})</span>}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="ml-12">
          {/* Announcements tab */}
          {tab === 'announcements' && (
            <div className="space-y-4">
              {(announcements as any[]).length === 0 ? (
                <Card className="border-dashed bg-transparent shadow-none">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Megaphone size={32} className="mb-3 opacity-20" />
                    <p>No posts yet in this club</p>
                  </CardContent>
                </Card>
              ) : (
                (announcements as any[]).map((a) => (
                  <Link
                    key={a.id}
                    href={`/announcements/${a.id}`}
                    className="block"
                  >
                    <Card className="hover:bg-muted/50 transition-colors border-l-4 border-l-transparent hover:border-l-primary/50">
                      <CardContent className="p-4 sm:p-5">
                        <h3 className="font-semibold text-foreground">{a.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {a.author?.firstName} {a.author?.lastName} ·{' '}
                          {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                          {a._count?.comments > 0 && ` · ${a._count.comments} comments`}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* Members tab */}
          {tab === 'members' && (
            <div className="space-y-3">
              {/* Sponsors */}
              {club.sponsors?.map((s: any) => (
                <Card key={s.userId} className="bg-muted/30">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{s.user.firstName} {s.user.lastName}</p>
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 mt-1">Sponsor</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {/* Members */}
              {club.members?.map((m: any) => (
                <Card key={m.userId} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{m.user.firstName} {m.user.lastName}</p>
                        {m.role === 'LEADER' && (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 h-5 px-1.5">
                            <Crown size={10} className="mr-1" /> Leader
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 block">{m.user.uniqueId}</span>
                    </div>
                    {canManageMembers && m.userId !== user?.id && (
                      <div className="flex gap-2">
                        {m.role === 'MEMBER' && isSponsor && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => promoteMutation.mutate(m.userId)}
                          >
                            <Crown size={14} className="mr-1.5" /> Promote
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeMutation.mutate(m.userId)}
                        >
                          <UserMinus size={14} className="mr-1.5" /> Remove
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

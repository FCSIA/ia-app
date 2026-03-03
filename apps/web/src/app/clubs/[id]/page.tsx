'use client';

import { use, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi, announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, UserPlus, Crown, UserMinus, Megaphone } from 'lucide-react';

export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const qc = useQueryClient();
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
    onSuccess: () => { setShowInvite(false); setInviteId(''); toast.success('Invite sent'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to invite'),
  });

  const promoteMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.promoteMember(id, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', id] }); toast.success('Member promoted to leader'); },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => clubsApi.removeMember(id, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['club', id] }); toast.success('Member removed'); },
  });

  const postMutation = useMutation({
    mutationFn: (d: any) => announcementsApi.create({ ...d, targetType: 'CLUB', clubId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-announcements', id] });
      setShowPost(false);
      setPostForm({ title: '', body: '', allowComments: false });
      toast.success('Posted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to post'),
  });

  if (isLoading) return (
    <AppShell><div className="text-center py-16 text-white/35">Loading...</div></AppShell>
  );
  if (!club) return (
    <AppShell><div className="text-center py-16 text-white/35">Club not found or access denied</div></AppShell>
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
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/clubs"
            className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-white">{club.name}</h1>
          {isLeader && <span className="badge-yellow flex items-center gap-1"><Crown size={10} /> Leader</span>}
          {isSponsor && <span className="badge-blue">Sponsor</span>}
        </div>
        {club.description && (
          <p className="text-white/45 text-sm mb-4 ml-11">{club.description}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-6 ml-11">
          {(canManageMembers || isLeader) && (
            <button
              onClick={() => setShowInvite(true)}
              className="btn-secondary text-sm flex items-center gap-1 py-1.5"
            >
              <UserPlus size={14} /> Invite
            </button>
          )}
          {canPost && (
            <button
              onClick={() => setShowPost(true)}
              className="btn-primary text-sm flex items-center gap-1 py-1.5"
            >
              <Plus size={14} /> Post
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="card mb-4">
            <h3 className="font-medium text-white/90 mb-3">Invite by User ID</h3>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Student/Staff unique ID (e.g. STU001)"
                value={inviteId}
                onChange={(e) => setInviteId(e.target.value)}
              />
              <button
                onClick={() => inviteId.trim() && inviteMutation.mutate(inviteId.trim())}
                className="btn-primary text-sm"
                disabled={inviteMutation.isPending}
              >
                Send Invite
              </button>
              <button onClick={() => setShowInvite(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* New post form */}
        {showPost && canPost && (
          <div className="card mb-4">
            <h3 className="font-medium text-white/90 mb-3">New Club Post</h3>
            <form onSubmit={(e) => { e.preventDefault(); postMutation.mutate(postForm); }} className="space-y-3">
              <input
                className="input"
                placeholder="Title"
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                required
              />
              <textarea
                className="input"
                placeholder="Write your post..."
                value={postForm.body}
                onChange={(e) => setPostForm({ ...postForm, body: e.target.value })}
                rows={4}
                required
              />
              <label className="flex items-center gap-2 text-sm text-white/55 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-accent-500"
                  checked={postForm.allowComments}
                  onChange={(e) => setPostForm({ ...postForm, allowComments: e.target.checked })}
                />
                Allow comments
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm" disabled={postMutation.isPending}>Post</button>
                <button type="button" onClick={() => setShowPost(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-white/[0.08] mb-5">
          {(['announcements', 'members'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-200 capitalize ${
                tab === t
                  ? 'border-accent-500 text-accent-400'
                  : 'border-transparent text-white/45 hover:text-white/70'
              }`}
            >
              {t} {t === 'members' && <span className="text-white/30">({club.members?.length || 0})</span>}
            </button>
          ))}
        </div>

        {/* Announcements tab */}
        {tab === 'announcements' && (
          <div className="space-y-3">
            {(announcements as any[]).length === 0 ? (
              <div className="card text-center py-12 text-white/30">
                <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
                <p>No posts yet in this club</p>
              </div>
            ) : (
              (announcements as any[]).map((a) => (
                <Link
                  key={a.id}
                  href={`/announcements/${a.id}`}
                  className="card block hover:-translate-y-0.5 transition-all duration-200"
                >
                  <h3 className="font-semibold text-white/90 hover:text-accent-400 transition-colors">{a.title}</h3>
                  <p className="text-xs text-white/35 mt-1">
                    {a.author?.firstName} {a.author?.lastName} ·{' '}
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    {a._count?.comments > 0 && ` · ${a._count.comments} comments`}
                  </p>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Members tab */}
        {tab === 'members' && (
          <div className="space-y-2">
            {/* Sponsors */}
            {club.sponsors?.map((s: any) => (
              <div key={s.userId} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-white/90">{s.user.firstName} {s.user.lastName}</p>
                  <span className="badge-blue text-xs mt-0.5 inline-block">Sponsor</span>
                </div>
              </div>
            ))}
            {/* Members */}
            {club.members?.map((m: any) => (
              <div key={m.userId} className="card flex items-center justify-between hover:-translate-y-0.5 transition-all duration-200">
                <div>
                  <p className="font-medium text-white/90">{m.user.firstName} {m.user.lastName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/35 font-mono">{m.user.uniqueId}</span>
                    {m.role === 'LEADER' && (
                      <span className="badge-yellow flex items-center gap-1 text-xs">
                        <Crown size={9} /> Leader
                      </span>
                    )}
                  </div>
                </div>
                {canManageMembers && m.userId !== user?.id && (
                  <div className="flex gap-3">
                    {m.role === 'MEMBER' && isSponsor && (
                      <button
                        onClick={() => promoteMutation.mutate(m.userId)}
                        className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1 transition-colors"
                      >
                        <Crown size={12} /> Promote
                      </button>
                    )}
                    <button
                      onClick={() => removeMutation.mutate(m.userId)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      <UserMinus size={12} /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

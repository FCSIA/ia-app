'use client';

import { use, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, moderationApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Flag, Trash2, Send } from 'lucide-react';
import Link from 'next/link';

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const router = useRouter();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { data: ann, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getOne(id).then((r) => r.data),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => announcementsApi.addComment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcement', id] }); setComment(''); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to post comment'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => announcementsApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcement', id] }),
  });

  const reportMutation = useMutation({
    mutationFn: () => moderationApi.submitReport({ contentType: 'ANNOUNCEMENT', contentId: id, reason: reportReason }),
    onSuccess: () => { setShowReport(false); setReportReason(''); toast.success('Report submitted'); },
  });

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-40 text-white/35">Loading...</div>
    </AppShell>
  );
  if (!ann) return (
    <AppShell>
      <div className="text-center py-16 text-white/35">Announcement not found</div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/announcements"
            className="p-2 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-200"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-white flex-1">{ann.title}</h1>
          <button
            onClick={() => setShowReport(true)}
            className="p-2 rounded-xl text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-200"
            title="Report"
          >
            <Flag size={15} />
          </button>
        </div>

        {/* Announcement body */}
        <div className="card mb-4">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {ann.isAdminGeneral && <span className="badge-red">Admin</span>}
            <span className="badge-blue">{ann.targetType.replace(/_/g, ' ')}</span>
            {ann.status !== 'ACTIVE' && <span className="badge-gray">{ann.status}</span>}
          </div>
          <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{ann.body}</div>
          <div className="mt-5 pt-4 border-t border-white/[0.06] text-xs text-white/35 flex items-center gap-1">
            Posted by{' '}
            <span className="text-white/50 font-medium">{ann.author?.firstName} {ann.author?.lastName}</span>
            {' '}·{' '}
            {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Comments */}
        {ann.allowComments && (
          <div className="card">
            <h2 className="font-semibold text-white/90 mb-4">
              Comments <span className="text-white/35 font-normal text-sm">({ann.comments?.length || 0})</span>
            </h2>

            <div className="space-y-3 mb-4">
              {ann.comments?.map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.6), rgba(234,88,12,0.6))', border: '1px solid rgba(249,115,22,0.3)' }}>
                    {c.author.firstName[0]}
                  </div>
                  {/* Bubble */}
                  <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white/80">{c.author.firstName} {c.author.lastName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                        {(c.authorId === user?.id || user?.roles?.some((r: string) => ['ADMIN', 'SUPER_ADMIN'].includes(r))) && (
                          <button
                            onClick={() => deleteCommentMutation.mutate(c.id)}
                            className="text-white/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-white/65 mt-0.5">{c.body}</p>
                  </div>
                </div>
              ))}
              {!ann.comments?.length && (
                <p className="text-white/30 text-sm py-2">No comments yet. Be the first!</p>
              )}
            </div>

            {/* Comment input */}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Write a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && comment.trim()) {
                    e.preventDefault();
                    addCommentMutation.mutate(comment.trim());
                  }
                }}
              />
              <button
                onClick={() => comment.trim() && addCommentMutation.mutate(comment.trim())}
                disabled={!comment.trim() || addCommentMutation.isPending}
                className="btn-primary px-3"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Report modal */}
        {showReport && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
            <div className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'rgba(18,15,13,0.95)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
              <h2 className="font-semibold text-white mb-4">Report Announcement</h2>
              <textarea
                className="input mb-4"
                placeholder="Describe your reason for reporting..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => reportMutation.mutate()}
                  disabled={!reportReason.trim() || reportMutation.isPending}
                  className="btn-primary text-sm"
                >
                  Submit Report
                </button>
                <button onClick={() => setShowReport(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

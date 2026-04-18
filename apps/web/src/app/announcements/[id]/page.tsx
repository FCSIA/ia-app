'use client';

import { use, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi, moderationApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
// import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Flag, Trash2, Send } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import {
  ANNOUNCEMENT_BADGE_TEXT_CLASS,
  ANNOUNCEMENT_TAG_LABELS,
} from '@/components/announcements/announcement-card';

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { data: ann, isLoading } = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getOne(id).then((r) => r.data),
  });

  const autoReadMutation = useMutation({
    mutationFn: () => announcementsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['announcement', id] });
    },
  });

  useEffect(() => {
    if (ann && !ann.isRead && !autoReadMutation.isPending) {
      autoReadMutation.mutate();
    }
  }, [ann, autoReadMutation]);

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => announcementsApi.addComment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['announcement', id] }); setComment(''); },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to post comment', variant: 'destructive' }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => announcementsApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcement', id] }),
  });

  const reportMutation = useMutation({
    mutationFn: () => moderationApi.submitReport({ contentType: 'ANNOUNCEMENT', contentId: id, reason: reportReason }),
    onSuccess: () => { setShowReport(false); setReportReason(''); toast({ title: 'Report submitted' }); },
  });

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-40 text-muted-foreground">Loading...</div>
    </AppShell>
  );
  if (!ann) return (
    <AppShell>
      <div className="text-center py-16 text-muted-foreground">Announcement not found</div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/announcements">
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">{ann.title}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReport(true)}
            className="text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
            title="Report"
          >
            <Flag size={18} />
          </Button>
        </div>

        {/* Announcement body */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {ann.isAdminGeneral ? (
                <Badge variant="destructive" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Admin
                </Badge>
              ) : null}
              <Badge
                variant="secondary"
                className={`${ANNOUNCEMENT_BADGE_TEXT_CLASS} bg-blue-500/10 text-blue-500 hover:bg-blue-500/20`}
              >
                {ANNOUNCEMENT_TAG_LABELS[ann.targetType] || ann.targetType.replace(/_/g, ' ')}
              </Badge>
              {ann.club?.name ? (
                <Badge variant="outline" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  {ann.club.name}
                </Badge>
              ) : null}
              {ann.status !== 'ACTIVE' ? (
                <Badge variant="outline" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  {ann.status}
                </Badge>
              ) : null}
            </div>
            <div className="mb-5 flex justify-end">
              <AnnouncementReadToggle announcementId={ann.id} isRead={ann.isRead} />
            </div>
            <div className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">{ann.body}</div>
            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground flex items-center gap-1">
              Posted by{' '}
              <span className="text-foreground/70 font-medium">{ann.author?.firstName} {ann.author?.lastName}</span>
              {' '}·{' '}
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
            </div>
          </CardContent>
        </Card>

        {/* Comments */}
        {ann.allowComments && (
          <Card>
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                Comments
                <Badge variant="secondary" className="font-normal">{ann.comments?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {ann.comments?.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-accent-500 to-orange-600 shadow-sm border border-accent-500/20">
                      {c.author.firstName[0]}
                    </div>
                    {/* Bubble */}
                    <div className="flex-1 rounded-xl px-4 py-3 bg-muted/50 border">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{c.author.firstName} {c.author.lastName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                          {(c.authorId === user?.id || user?.roles?.some((r: string) => ['ADMIN', 'SUPER_ADMIN'].includes(r))) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1.5"
                              onClick={() => deleteCommentMutation.mutate(c.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80">{c.body}</p>
                    </div>
                  </div>
                ))}
                {!ann.comments?.length && (
                  <p className="text-muted-foreground text-sm py-4 text-center">No comments yet. Be the first!</p>
                )}
              </div>

              {/* Comment input */}
              <div className="flex gap-2">
                <Input
                  className="flex-1"
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
                <Button
                  onClick={() => comment.trim() && addCommentMutation.mutate(comment.trim())}
                  disabled={!comment.trim() || addCommentMutation.isPending}
                  className="px-4"
                >
                  <Send size={16} className="mr-2" /> Post
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report modal */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Announcement</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Describe your reason for reporting..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowReport(false)}>Cancel</Button>
              <Button
                onClick={() => reportMutation.mutate()}
                disabled={!reportReason.trim() || reportMutation.isPending}
              >
                Submit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

'use client';

import { use, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  Clock3,
  Flag,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import {
  ANNOUNCEMENT_BADGE_TEXT_CLASS,
  ANNOUNCEMENT_TAG_COLORS,
  ANNOUNCEMENT_TAG_LABELS,
  type AnnouncementCardRecord,
} from '@/components/announcements/announcement-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { announcementsApi, moderationApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AnnouncementComment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type AnnouncementDetail = AnnouncementCardRecord & {
  targetGrade?: number | null;
  targetPathway?: string | null;
  readAt?: string | null;
  comments?: AnnouncementComment[];
  author?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

function formatPathway(pathway?: string | null) {
  if (!pathway) return null;
  if (pathway === 'HEALTH_SCIENCE') return 'Health Science';
  if (pathway === 'INFORMATION_TECHNOLOGY') return 'Information Technology';
  if (pathway === 'ENGINEERING') return 'Engineering';
  return pathway.replace(/_/g, ' ');
}

function formatAudience(announcement: AnnouncementDetail) {
  if (announcement.targetType === 'GRADE' && announcement.targetGrade) {
    return `Grade ${announcement.targetGrade}`;
  }

  if (announcement.targetType === 'PATHWAY') {
    return formatPathway(announcement.targetPathway) ?? 'Pathway audience';
  }

  if (announcement.targetType === 'CLUB') {
    return announcement.club?.name ?? 'Club members';
  }

  return 'School-wide';
}

function formatStatus(status: string) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'EXPIRED') return 'Expired';
  if (status === 'ARCHIVED') return 'Archived';
  return status.replace(/_/g, ' ');
}

function formatName(person?: {
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'Unknown author';
}

function getInitials(person?: {
  firstName?: string | null;
  lastName?: string | null;
} | null) {
  const initials = [person?.firstName?.[0], person?.lastName?.[0]].filter(Boolean).join('');
  return initials || '?';
}

function LoadingBlock({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-primary/10', className)} />;
}

function AnnouncementDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <LoadingBlock className="h-9 w-24 rounded-full" />
        <LoadingBlock className="h-9 w-9 rounded-full" />
      </div>
      <div className="rounded-2xl border border-border/70 bg-card px-6 py-6 shadow-sm">
        <div className="flex gap-2">
          <LoadingBlock className="h-5 w-20 rounded-full" />
          <LoadingBlock className="h-5 w-24 rounded-full" />
        </div>
        <LoadingBlock className="mt-4 h-10 w-3/4" />
        <LoadingBlock className="mt-3 h-4 w-1/2" />
        <div className="mt-6 space-y-3">
          <LoadingBlock className="h-4 w-full" />
          <LoadingBlock className="h-4 w-full" />
          <LoadingBlock className="h-4 w-11/12" />
          <LoadingBlock className="h-4 w-10/12" />
        </div>
      </div>
      <div className="space-y-4">
        <LoadingBlock className="h-5 w-28" />
        <LoadingBlock className="h-16 w-full rounded-xl" />
        <LoadingBlock className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { data: announcement, isLoading } = useQuery<AnnouncementDetail>({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.getOne(id).then((response) => response.data),
  });

  const autoReadMutation = useMutation({
    mutationFn: () => announcementsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
    },
  });

  useEffect(() => {
    if (!announcement || announcement.isRead || autoReadMutation.isPending) return;
    autoReadMutation.mutate();
  }, [announcement, autoReadMutation]);

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => announcementsApi.addComment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement', id] });
      setComment('');
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to post comment',
        variant: 'destructive',
      }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => announcementsApi.deleteComment(commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcement', id] }),
    onError: () =>
      toast({
        title: 'Failed to delete comment',
        variant: 'destructive',
      }),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      moderationApi.submitReport({
        contentType: 'ANNOUNCEMENT',
        contentId: id,
        reason: reportReason,
      }),
    onSuccess: () => {
      setShowReport(false);
      setReportReason('');
      toast({ title: 'Report submitted' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to submit report',
        variant: 'destructive',
      }),
  });

  if (isLoading) {
    return (
      <AppShell>
        <AnnouncementDetailSkeleton />
      </AppShell>
    );
  }

  if (!announcement) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-foreground">
              <Archive className="size-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">Announcement not found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The post may have been removed or you may not have access to it anymore.
            </p>
            <Button asChild className="mt-6">
              <Link href="/announcements">Back to announcements</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const authorName = formatName(announcement.author);
  const audienceLabel = formatAudience(announcement);
  const commentCount = announcement.comments?.length ?? 0;
  const canDeleteComment = (commentAuthorId: string) =>
    commentAuthorId === user?.id ||
    !!user?.roles?.some((role: string) => ['ADMIN', 'SUPER_ADMIN'].includes(role));

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-full">
            <Link href="/announcements">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            onClick={() => setShowReport(true)}
            aria-label="Report announcement"
          >
            <Flag className="size-4" />
          </Button>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="gap-5 bg-muted/20 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              {announcement.isAdminGeneral ? (
                <Badge variant="destructive" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Admin
                </Badge>
              ) : null}
              <Badge
                className={cn(
                  ANNOUNCEMENT_BADGE_TEXT_CLASS,
                  ANNOUNCEMENT_TAG_COLORS[announcement.targetType] ||
                    'bg-muted text-muted-foreground',
                )}
              >
                {ANNOUNCEMENT_TAG_LABELS[announcement.targetType] || announcement.targetType}
              </Badge>
              <Badge variant="outline" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                {audienceLabel}
              </Badge>
              {announcement.status !== 'ACTIVE' ? (
                <Badge variant="secondary" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  {formatStatus(announcement.status)}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-3">
              <CardTitle className="text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
                {announcement.title}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>Posted by {authorName}</span>
                <span>{formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}</span>
                {announcement.expiresAt ? (
                  <span>Expires {format(new Date(announcement.expiresAt), 'MMM d')}</span>
                ) : null}
                {announcement.allowComments ? <span>{commentCount} comments</span> : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {announcement.status === 'EXPIRED' ? (
              <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <Clock3 className="size-4" />
                Expired announcement
              </p>
            ) : null}

            {announcement.status === 'ARCHIVED' ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Archive className="size-4" />
                Archived announcement
              </p>
            ) : null}

            <div className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
              {announcement.body}
            </div>
          </CardContent>
        </Card>

        {announcement.allowComments ? (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Discussion</h2>
                <p className="text-sm text-muted-foreground">
                  Questions and follow-up only.
                </p>
              </div>
              <Badge variant="secondary">
                {commentCount} comment{commentCount === 1 ? '' : 's'}
              </Badge>
            </div>

            {commentCount > 0 ? (
              <div className="space-y-4">
                {announcement.comments?.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                        {getInitials(entry.author)}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {formatName(entry.author)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.createdAt), 'EEE, MMM d · h:mm a')}
                            </p>
                          </div>

                          {canDeleteComment(entry.authorId) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-muted-foreground hover:text-destructive"
                              disabled={deleteCommentMutation.isPending}
                              onClick={() => deleteCommentMutation.mutate(entry.id)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>

                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                          {entry.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                  <MessageSquare className="size-5" />
                </div>
                <p className="mt-4 font-medium text-foreground">No comments yet</p>
              </div>
            )}

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!comment.trim()) return;
                addCommentMutation.mutate(comment.trim());
              }}
            >
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment"
                rows={3}
                className="min-h-24 resize-y"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!comment.trim() || addCommentMutation.isPending}>
                  <Send className="mr-2 size-4" />
                  {addCommentMutation.isPending ? 'Posting…' : 'Post comment'}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report announcement</DialogTitle>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!reportReason.trim()) return;
                reportMutation.mutate();
              }}
            >
              <Textarea
                placeholder="Describe the issue with this announcement"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                rows={4}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowReport(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!reportReason.trim() || reportMutation.isPending}
                >
                  {reportMutation.isPending ? 'Submitting…' : 'Submit report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

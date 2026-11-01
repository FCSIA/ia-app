'use client';

import { use, useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Bookmark, Flag, Send, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AppShell } from '@/components/layout/AppShell';
import { AnnouncementAudience } from '@/components/announcements/announcement-audience-label';
import { AnnouncementAuthor } from '@/components/announcements/announcement-author';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { AnnouncementMedia } from '@/components/announcements/announcement-media';
import { Card, CardContent, CardGroup, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAnnouncementFeedClock } from '@/components/announcements/use-announcement-feed-clock';

const MAX_ANNOUNCEMENT_COMMENT_CHARACTERS = 2_000;

function formatStatus(status: string) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'ARCHIVED') return 'Archived';
  return status.replace(/_/g, ' ');
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
      <CardGroup corners="compact" border="outlined"><Card><CardContent className="space-y-4">
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
      </CardContent></Card></CardGroup>
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
  const announcementNow = useAnnouncementFeedClock(3_600_000);
  const user = useCurrentUser();
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [deleteCommentPending, setDeleteCommentPending] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const markReadAttemptsRef = useRef<Set<string> | null>(null);
  if (markReadAttemptsRef.current === null) {
    markReadAttemptsRef.current = new Set<string>();
  }

  const detail = useQuery(api.announcements.feed.get, {
    announcementId: id as Id<'announcements'>,
    now: announcementNow,
  });
  const isLoading = detail === undefined;
  const announcement = detail ? { ...detail.announcement, comments: detail.comments } : null;
  const shouldMarkRead = announcement !== null && !announcement.isRead;

  const markRead = useMutation(api.announcements.engagement.markRead);
  const bookmark = useMutation(api.announcements.engagement.bookmark);
  const unbookmark = useMutation(api.announcements.engagement.unbookmark);
  const addComment = useMutation(api.announcements.comments.add);
  const removeComment = useMutation(api.announcements.comments.remove);
  const submitReport = useMutation(api.moderation.reports.submit);

  useEffect(() => {
    const markReadAttempts = markReadAttemptsRef.current;
    if (!markReadAttempts || !shouldMarkRead || markReadAttempts.has(id)) return;
    markReadAttempts.add(id);
    void markRead({ announcementId: id as Id<'announcements'> }).catch(() => {
      markReadAttempts.delete(id);
    });
  }, [id, markRead, shouldMarkRead]);

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
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Announcement not found</EmptyTitle>
              <EmptyDescription>The post may have been removed or you may not have access to it anymore.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent><Button asChild>
              <Link href="/announcements">Back to announcements</Link>
            </Button></EmptyContent>
          </Empty>
        </div>
      </AppShell>
    );
  }

  const commentCount = announcement.comments?.length ?? 0;
  const canDeleteComment = (commentAuthorId: string) =>
    commentAuthorId === user?._id || !!user?.roles?.some((role: string) => ['ADMIN', 'SUPER_ADMIN'].includes(role));

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild leadingIcon={ArrowLeft}>
            <Link href="/announcements">
              Back
            </Link>
          </Button>

          <div className="flex items-center gap-1">
          <Tooltip content={announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}>
            <Button
              type="button"
              variant={announcement.isBookmarked ? 'tertiary' : 'ghost'}
              size="icon-sm"
              active={announcement.isBookmarked}
              aria-pressed={!!announcement.isBookmarked}
              aria-label={announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}
              loading={bookmarkPending}
              onClick={() => {
                setBookmarkPending(true);
                const action = announcement.isBookmarked ? unbookmark : bookmark;
                void action({ announcementId: id as Id<'announcements'> })
                  .catch(() => toast({ title: 'Could not update saved announcement', variant: 'destructive' }))
                  .finally(() => setBookmarkPending(false));
              }}
            >
              <Bookmark fill={announcement.isBookmarked ? 'currentColor' : 'none'} className={announcement.isBookmarked ? 'text-primary' : undefined} />
            </Button>
          </Tooltip>
          <Tooltip content="Report announcement"><Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowReport(true)}
            aria-label="Report announcement"
          >
            <Flag />
          </Button></Tooltip>
          </div>
        </div>

        <CardGroup corners="compact" border="outlined"><Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <AnnouncementAudience announcement={announcement} />
              {announcement.isPromoted ? <span>Important</span> : null}
              {announcement.status !== 'ACTIVE' ? (
                <Badge variant="solid" size="sm">
                  {formatStatus(announcement.status)}
                </Badge>
              ) : null}
            </div>

            <h1 className="break-words text-xl font-semibold leading-snug text-foreground sm:text-2xl">{announcement.title}</h1>
            <AnnouncementAuthor author={announcement.author}>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <time dateTime={new Date(announcement.createdAt).toISOString()}>
                  {formatDistanceToNow(new Date(announcement.createdAt), {
                    addSuffix: true,
                  })}
                </time>
                {announcement.expiresAt ? <span>Expires {format(new Date(announcement.expiresAt), 'MMM d')}</span> : null}
              </div>
            </AnnouncementAuthor>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            {announcement.bodyMarkdown ? (
              <div className="typeset max-w-none text-base leading-7 text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement.bodyMarkdown}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-base leading-7 text-foreground">{announcement.body}</div>
            )}
            <AnnouncementMedia images={announcement.images} embedUrls={announcement.embedUrls} />
          </CardContent>
        </Card></CardGroup>

        {announcement.allowComments ? (
          <section id="comments" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Discussion <span className="ml-2 font-normal text-muted-foreground">{commentCount}</span></h2>
            </div>

            {commentCount > 0 ? (
              <ul className="space-y-5">
                {announcement.comments?.map((entry) => (
                  <li key={entry._id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <AnnouncementAuthor author={entry.author}>
                        <time dateTime={new Date(entry.createdAt).toISOString()}>{format(new Date(entry.createdAt), 'MMM d · h:mm a')}</time>
                      </AnnouncementAuthor>

                      {canDeleteComment(entry.authorId) ? (
                        <Tooltip content="Delete comment"><Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete comment"
                          loading={deleteCommentPending === entry._id}
                          onClick={() => {
                            setDeleteCommentPending(entry._id);
                            void removeComment({
                              commentId: entry._id as Id<'comments'>,
                            })
                              .catch(() =>
                                toast({
                                  title: 'Failed to delete comment',
                                  variant: 'destructive',
                                }),
                              )
                              .finally(() => setDeleteCommentPending(null));
                          }}
                        >
                          <Trash2 />
                        </Button></Tooltip>
                      ) : null}
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{entry.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!comment.trim()) return;
                setCommentPending(true);
                void addComment({
                  announcementId: id as Id<'announcements'>,
                  body: comment.trim(),
                })
                  .then(() => setComment(''))
                  .catch((error: unknown) =>
                    toast({
                      title: error instanceof Error ? error.message : 'Failed to post comment',
                      variant: 'destructive',
                    }),
                  )
                  .finally(() => setCommentPending(false));
              }}
            >
              <Textarea
                aria-label="Comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment"
                maxLength={MAX_ANNOUNCEMENT_COMMENT_CHARACTERS}
                rows={3}
                className="min-h-24 resize-y"
              />
              <div className="flex justify-end">
                <Button type="submit" leadingIcon={Send} disabled={!comment.trim() || commentPending}>
                  {commentPending ? 'Posting…' : 'Post comment'}
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
                setReportPending(true);
                void submitReport({
                  contentType: 'ANNOUNCEMENT',
                  contentId: id,
                  reason: reportReason,
                })
                  .then(() => {
                    setShowReport(false);
                    setReportReason('');
                    toast({ title: 'Report submitted' });
                  })
                  .catch((error: unknown) =>
                    toast({
                      title: error instanceof Error ? error.message : 'Failed to submit report',
                      variant: 'destructive',
                    }),
                  )
                  .finally(() => setReportPending(false));
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
                <Button type="submit" disabled={!reportReason.trim() || reportPending}>
                  {reportPending ? 'Submitting…' : 'Submit report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

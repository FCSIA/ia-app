import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Archive, Bookmark, BookmarkCheck, Clock, MessageCircle, Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const ANNOUNCEMENT_BADGE_TEXT_CLASS = 'text-[11px] leading-none';

export const ANNOUNCEMENT_TAG_BADGE_COLORS: Record<string, BadgeColor> = {
  SCHOOL_WIDE: 'blue',
  GRADE: 'violet',
  PATHWAY: 'emerald',
  CLUB: 'amber',
};

export const ANNOUNCEMENT_TAG_LABELS: Record<string, string> = {
  SCHOOL_WIDE: 'School-wide',
  GRADE: 'Grade',
  PATHWAY: 'Pathway',
  CLUB: 'Club',
};

export type AnnouncementCardRecord = {
  _id: string;
  title: string;
  body: string;
  createdAt: number | string;
  expiresAt?: number | string | null;
  isRead: boolean;
  isAdminGeneral?: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
  isPromoted?: boolean;
  allowComments?: boolean;
  status: string;
  targetType: string;
  author?: {
    _id?: string;
    firstName?: string | null;
    lastName?: string | null;
    isDeveloper?: boolean | null;
  } | null;
  club?: {
    _id: string;
    name: string;
  } | null;
  clubId?: string;
  _count?: {
    comments?: number;
  } | null;
};

type AnnouncementCardProps = {
  announcement: AnnouncementCardRecord;
  compact?: boolean;
  canArchive?: boolean;
  className?: string;
  footer?: ReactNode;
  index?: number;
  onArchive?: (announcementId: string) => void;
  onBookmarkToggle?: (announcement: AnnouncementCardRecord) => void;
  onPinToggle?: (announcement: AnnouncementCardRecord) => void;
};

export function AnnouncementCard({ compact = false, ...props }: AnnouncementCardProps) {
  return <AnnouncementPreview {...props} presentation={compact ? 'compact' : 'feed'} />;
}

export function AnnouncementWidgetCard(props: Omit<AnnouncementCardProps, 'compact'>) {
  return <AnnouncementPreview {...props} presentation="widget" />;
}

type AnnouncementPreviewProps = Omit<AnnouncementCardProps, 'compact'> & {
  presentation: 'feed' | 'compact' | 'widget';
};

function AnnouncementPreview({
  announcement,
  presentation,
  canArchive = false,
  className,
  footer,
  index,
  onArchive,
  onBookmarkToggle,
  onPinToggle,
}: AnnouncementPreviewProps) {
  const widget = presentation === 'widget';
  const authorName = [announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(' ');

  const status = {
    PENDING_APPROVAL: { label: 'Pending review', color: 'amber' },
    REJECTED: { label: 'Needs changes', color: 'red' },
    EXPIRED: { label: 'Expired', color: 'gray' },
    ARCHIVED: { label: 'Archived', color: 'gray' },
  }[announcement.status] as { label: string; color: BadgeColor } | undefined;
  const audience = announcement.club?.name
    || ANNOUNCEMENT_TAG_LABELS[announcement.targetType]
    || (announcement.targetType === 'INTERSECTION' ? 'Combined audience' : announcement.targetType.replaceAll('_', ' '));
  const createdAt = new Date(announcement.createdAt);
  const audienceMetadata = <>
    <span>{audience}</span>
    {announcement.isPinned ? <span>Pinned for you</span> : null}
    {announcement.isPromoted ? <span>Featured</span> : null}
    {status ? <Badge variant="solid" size="sm" color={status.color}>{status.label}</Badge> : null}
  </>;

  return (
    <Card
      index={index}
      href={`/announcements/${announcement._id}`}
      label={`Open announcement: ${announcement.title} (${announcement.isRead ? 'Read' : 'Unread'})`}
      className={cn('announcement-card relative', className)}
      data-read-state={announcement.isRead ? 'read' : 'unread'}
    >
      <CardContent className="px-4 pt-4 sm:px-5">
        {!widget ? (
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {audienceMetadata}
          </div>
        ) : null}
        <h3 className={cn(
          'leading-snug',
          presentation === 'compact' ? 'line-clamp-1' : 'line-clamp-2',
          widget ? 'text-sm' : 'text-base',
          announcement.isRead ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground',
        )}>
          {announcement.title}
        </h3>
        {!widget ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{announcement.body}</p> : null}
      </CardContent>
      <CardFooter className={cn('flex items-center justify-between gap-y-2 px-4 sm:px-5', widget ? 'gap-x-2 pt-1' : 'flex-wrap gap-x-4 pt-3')}>
        <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground', widget ? 'flex-1 text-xs' : 'text-sm')}>
          {widget ? audienceMetadata : null}
          {!widget ? <>
            <span>{authorName || 'Unknown author'}<DeveloperBadge user={announcement.author} size={12} className="ml-1" /></span>
            <span aria-hidden>·</span>
          </> : null}
          <time dateTime={createdAt.toISOString()} title={createdAt.toLocaleString()}>
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </time>
          {announcement.expiresAt ? (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" />
              {new Date(announcement.expiresAt).getTime() <= Date.now() ? 'Expired' : 'Expires'} {formatDistanceToNow(new Date(announcement.expiresAt), { addSuffix: true })}
            </span>
          ) : null}
        </div>
        <div className={cn('flex flex-wrap items-center gap-1', widget ? 'shrink-0' : 'max-w-full')}>
          <Tooltip content={announcement.isRead ? 'Mark unread' : 'Mark read'}>
            <AnnouncementReadToggle announcementId={announcement._id} isRead={announcement.isRead} iconOnly variant="ghost" />
          </Tooltip>
          {onBookmarkToggle ? (
            <Tooltip content={announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}>
              <Button
                variant="ghost"
                size="icon-sm"
                active={announcement.isBookmarked}
                onClick={() => onBookmarkToggle(announcement)}
                aria-label={`${announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}: ${announcement.title}`}
              >
                {announcement.isBookmarked ? <BookmarkCheck /> : <Bookmark />}
              </Button>
            </Tooltip>
          ) : null}
          {announcement.allowComments ? (
            <Tooltip content="Open comments">
              <Button asChild variant="ghost" size={widget ? 'icon-sm' : 'sm'} leadingIcon={widget ? undefined : MessageCircle}>
                <Link href={`/announcements/${announcement._id}#comments`} aria-label={`Open comments: ${announcement.title}`}>
                  {widget ? <MessageCircle /> : `${announcement._count?.comments || 0} comments`}
                </Link>
              </Button>
            </Tooltip>
          ) : null}
          {onPinToggle && announcement.status === 'ACTIVE' ? (
            <Tooltip content={announcement.isPinned ? 'Unpin from your feed' : 'Pin to top for you'}>
              <Button
                variant="ghost"
                size="icon-sm"
                active={announcement.isPinned}
                onClick={() => onPinToggle(announcement)}
                aria-label={`${announcement.isPinned ? 'Unpin from your feed' : 'Pin to top for you'}: ${announcement.title}`}
              >
                {announcement.isPinned ? <PinOff /> : <Pin />}
              </Button>
            </Tooltip>
          ) : null}
          {canArchive && announcement.status === 'ACTIVE' && onArchive ? (
            <Tooltip content="Archive announcement">
              <Button variant="ghost" size="icon-sm" onClick={() => onArchive(announcement._id)} aria-label={`Archive announcement: ${announcement.title}`}>
                <Archive />
              </Button>
            </Tooltip>
          ) : null}
        </div>
        {footer ? <div className="w-full">{footer}</div> : null}
      </CardFooter>
    </Card>
  );
}

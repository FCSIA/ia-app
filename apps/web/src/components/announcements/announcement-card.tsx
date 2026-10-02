import { displayName } from '~/apps/shared/user-name';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Archive, Bookmark, BookmarkCheck, Clock, MessageCircle, Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  SCHOOL_WIDE: 'School Wide',
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
    preferredName?: string | null;
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

export function AnnouncementCard({
  announcement,
  compact = false,
  canArchive = false,
  className,
  footer,
  index,
  onArchive,
  onBookmarkToggle,
  onPinToggle,
}: AnnouncementCardProps) {
  const authorName = displayName(announcement.author);

  const statusStyle = announcement.status === 'ACTIVE'
    ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/25'
    : announcement.status === 'PENDING_APPROVAL'
    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
    : announcement.status === 'REJECTED'
    ? 'bg-red-500/15 text-red-500 border-red-500/30 hover:bg-red-500/25'
    : announcement.status === 'EXPIRED'
    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
    : announcement.status === 'ARCHIVED'
    ? 'bg-gray-500/15 text-gray-500 border-gray-500/30 hover:bg-gray-500/25'
    : 'bg-muted text-muted-foreground';

  const targetColor = ANNOUNCEMENT_TAG_BADGE_COLORS[announcement.targetType] ?? 'gray';

  return (
    <Card
      index={index}
      href={`/announcements/${announcement._id}`}
      label={`Open announcement: ${announcement.title}`}
      className={cn('announcement-card relative', !announcement.isRead && 'border-l-2 border-l-primary', className)}
    >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                {announcement.isAdminGeneral ? (
                  <Badge variant="solid" color="red" size="sm">
                    Push notification
                  </Badge>
                ) : null}
                {announcement.isPinned ? (
                  <Badge variant="solid" color="amber" size="sm" className="gap-1">
                    <Pin size={10} />
                    Pinned
                  </Badge>
                ) : null}
                {announcement.isPromoted ? (
                  <Badge variant="solid" color="amber" size="sm">
                    Promoted
                  </Badge>
                ) : null}
                {announcement.isBookmarked ? (
                  <Badge variant="solid" color="blue" size="sm" className="gap-1">
                    <BookmarkCheck size={10} />
                    Saved
                  </Badge>
                ) : null}
                {announcement.status !== 'ACTIVE' ? (
                  <Badge variant="solid" size="sm" className={cn(statusStyle)}>
                    {announcement.status === 'PENDING_APPROVAL' && 'Pending review'}
                    {announcement.status === 'REJECTED' && 'Needs changes'}
                    {announcement.status === 'EXPIRED' && 'Expired'}
                    {announcement.status === 'ARCHIVED' && 'Archived'}
                  </Badge>
                ) : null}
                <Badge variant="solid" size="sm" color={targetColor}>
                  {ANNOUNCEMENT_TAG_LABELS[announcement.targetType] || announcement.targetType.replace(/_/g, ' ')}
                </Badge>
                {announcement.club?.name ? (
                  <Badge variant="solid" color="emerald" size="sm">
                    {announcement.club.name}
                  </Badge>
                ) : null}
              </div>

              <h3 className={cn('font-semibold text-foreground leading-snug', compact ? 'line-clamp-1 text-sm' : 'line-clamp-2')}>
                {announcement.title}
              </h3>

              <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{announcement.body}</p>

              <p className={cn('mt-2.5 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                {authorName || 'Unknown author'}
                <DeveloperBadge user={announcement.author} size={12} className="mx-1" />
                {' '}·{' '}
                {formatDistanceToNow(new Date(announcement.createdAt), {
                  addSuffix: true,
                })}
                {announcement.expiresAt ? (
                  <span className="ml-2 text-amber-500">
                    <Clock size={12} className="inline mr-1" />
                    expires{' '}
                    {formatDistanceToNow(new Date(announcement.expiresAt), {
                      addSuffix: true,
                    })}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="relative z-30 flex-shrink-0 flex flex-col items-center gap-1">
              {announcement.allowComments ? (
                <Tooltip content="Open comments">
                  <Button asChild variant="ghost" size="sm" leadingIcon={MessageCircle} aria-label={`Open ${announcement._count?.comments || 0} comments`} className="gap-1.5">
                    <Link href={`/announcements/${announcement._id}#comments`}>{announcement._count?.comments || 0}</Link>
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip content={announcement.isRead ? 'Mark unread' : 'Mark read'}>
                <AnnouncementReadToggle announcementId={announcement._id} isRead={announcement.isRead} iconOnly variant="ghost" />
              </Tooltip>
              {onBookmarkToggle ? (
                <Tooltip content={announcement.isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onBookmarkToggle(announcement)}
                    aria-label={announcement.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                  >
                    {announcement.isBookmarked ? <BookmarkCheck /> : <Bookmark />}
                  </Button>
                </Tooltip>
              ) : null}
              {onPinToggle && announcement.status === 'ACTIVE' ? (
                <Tooltip content={announcement.isPinned ? 'Unpin announcement' : 'Pin announcement'}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onPinToggle(announcement)}
                    aria-label={announcement.isPinned ? 'Unpin announcement' : 'Pin announcement'}
                  >
                    {announcement.isPinned ? <PinOff /> : <Pin />}
                  </Button>
                </Tooltip>
              ) : null}
              {canArchive && announcement.status === 'ACTIVE' && onArchive ? (
                <Tooltip content="Archive announcement">
                  <Button variant="ghost" size="icon-sm" onClick={() => onArchive(announcement._id)} aria-label="Archive announcement">
                    <Archive />
                  </Button>
                </Tooltip>
              ) : null}
            </div>
          </div>

          {footer ? <div className="mt-4">{footer}</div> : null}
        </CardContent>
    </Card>
  );
}

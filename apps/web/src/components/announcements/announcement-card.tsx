import { formatDistanceToNow } from 'date-fns';
import { Archive, Bookmark, BookmarkCheck, Clock, MessageCircle, Pin } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
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
  allowComments?: boolean;
  status: string;
  targetType: string;
  author?: {
    _id?: string;
    firstName?: string | null;
    lastName?: string | null;
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
}: AnnouncementCardProps) {
  const authorName = [announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(' ');

  return (
    <Card index={index} href={`/announcements/${announcement._id}`} label={`Open announcement: ${announcement.title}`} className={cn('relative', className)}>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {!announcement.isRead ? (
                <Badge variant="dot" color="blue" size="sm">
                  Unread
                </Badge>
              ) : null}
              {announcement.isAdminGeneral ? (
                <Badge variant="solid" color="red" size="sm">
                  Push notification
                </Badge>
              ) : null}
              {announcement.isPinned ? (
                <Badge variant="solid" color="amber" size="sm">
                  <Pin className="size-3" />
                  Pinned
                </Badge>
              ) : null}
              {announcement.isBookmarked ? (
                <Badge variant="solid" color="blue" size="sm">
                  <BookmarkCheck className="size-3" />
                  Saved
                </Badge>
              ) : null}
              {announcement.status === 'PENDING_APPROVAL' ? (
                <Badge variant="solid" color="orange" size="sm">
                  Pending review
                </Badge>
              ) : null}
              {announcement.status === 'REJECTED' ? (
                <Badge variant="solid" color="red" size="sm">
                  Needs changes
                </Badge>
              ) : null}
              {announcement.status === 'EXPIRED' ? (
                <Badge variant="solid" color="gray" size="sm">
                  Expired
                </Badge>
              ) : null}
              {announcement.status === 'ARCHIVED' ? (
                <Badge variant="solid" color="gray" size="sm">
                  Archived
                </Badge>
              ) : null}
              <Badge size="sm" color={ANNOUNCEMENT_TAG_BADGE_COLORS[announcement.targetType] ?? 'gray'}>
                {ANNOUNCEMENT_TAG_LABELS[announcement.targetType] || announcement.targetType.replace(/_/g, ' ')}
              </Badge>
              {announcement.club?.name ? (
                <Badge variant="solid" color="emerald" size="sm">
                  {announcement.club.name}
                </Badge>
              ) : null}
            </div>

            <h3 className={cn('font-semibold text-foreground/90', compact ? 'line-clamp-1 text-sm' : 'line-clamp-2')}>{announcement.title}</h3>

            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{announcement.body}</p>

            <p className={cn('mt-2 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
              {authorName || 'Unknown author'} ·{' '}
              {formatDistanceToNow(new Date(announcement.createdAt), {
                addSuffix: true,
              })}
              {announcement.expiresAt ? (
                <span className="ml-2 text-amber-500 dark:text-amber-400">
                  <Clock size={12} className="mr-1 inline" />
                  expires{' '}
                  {formatDistanceToNow(new Date(announcement.expiresAt), {
                    addSuffix: true,
                  })}
                </span>
              ) : null}
            </p>
          </div>

          <div className="relative z-30 flex shrink-0 flex-col items-end gap-1">
            {announcement.allowComments ? (
              <Badge color="gray" size="sm">
                <MessageCircle /> {announcement._count?.comments || 0}
              </Badge>
            ) : null}
            <AnnouncementReadToggle announcementId={announcement._id} isRead={announcement.isRead} />
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

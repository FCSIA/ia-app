import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Archive, Bookmark, Clock, Ellipsis, MessageCircle, Pin, PinOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { AnnouncementAudience } from '@/components/announcements/announcement-audience-label';
import type { AnnouncementAudienceInput } from '@/components/announcements/announcement-audience';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
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

export type AnnouncementCardRecord = AnnouncementAudienceInput & {
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
  commentCount?: number;
};

type AnnouncementCardProps = {
  announcement: AnnouncementCardRecord;
  compact?: boolean;
  canArchive?: boolean;
  className?: string;
  footer?: ReactNode;
  index?: number;
  /** Omit only the ordering label already named by the surrounding section. */
  orderingContext?: 'personal-pins' | 'important' | 'latest';
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
  orderingContext,
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
  const createdAt = new Date(announcement.createdAt);
  const audienceMetadata = <>
    <AnnouncementAudience announcement={announcement} />
    {orderingContext !== 'personal-pins' && announcement.isPinned ? <span>Pinned for you</span> : null}
    {orderingContext !== 'important' && announcement.isPromoted ? <span>Important</span> : null}
    {status ? <Badge variant="solid" size="sm" color={status.color}>{status.label}</Badge> : null}
  </>;
  const canPin = !!onPinToggle && announcement.status === 'ACTIVE';
  const canArchiveAnnouncement = canArchive && !!onArchive && announcement.status === 'ACTIVE';

  return (
    <Card
      index={index}
      href={`/announcements/${announcement._id}`}
      attention={!announcement.isRead}
      label={`Open announcement: ${announcement.title} (${announcement.isRead ? 'Read' : 'Unread'})`}
      className={cn('announcement-card relative', className)}
      data-read-state={announcement.isRead ? 'read' : 'unread'}
    >
      <CardContent className="px-4 pt-4 sm:px-5">
        {!widget ? <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {audienceMetadata}
        </div> : null}
        <h3 className={cn(
          'leading-snug text-foreground',
          !widget && 'mt-2',
          presentation === 'compact' ? 'line-clamp-1' : 'line-clamp-2',
          widget ? 'text-sm' : 'text-base',
          announcement.isRead ? 'font-normal' : 'font-semibold',
        )}>{announcement.title}</h3>
        {!widget ? <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">{announcement.body}</p> : null}
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
            <AnnouncementReadToggle announcementId={announcement._id} isRead={announcement.isRead} iconOnly={widget || presentation === 'compact'} variant="ghost" />
          </Tooltip>
          {onBookmarkToggle ? (
            <Tooltip content={announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}>
              <Button
                variant={announcement.isBookmarked ? 'tertiary' : 'ghost'}
                size="icon-sm"
                active={announcement.isBookmarked}
                aria-pressed={!!announcement.isBookmarked}
                onClick={() => onBookmarkToggle(announcement)}
                aria-label={`${announcement.isBookmarked ? 'Remove from saved' : 'Save announcement'}: ${announcement.title}`}
              >
                <Bookmark fill={announcement.isBookmarked ? 'currentColor' : 'none'} className={announcement.isBookmarked ? 'text-primary' : undefined} />
              </Button>
            </Tooltip>
          ) : null}
          {announcement.allowComments ? (
            <Tooltip content="Open comments">
              <Button asChild variant="ghost" size={widget || !announcement.commentCount ? 'icon-sm' : 'sm'} leadingIcon={widget || !announcement.commentCount ? undefined : MessageCircle}>
                <Link href={`/announcements/${announcement._id}#comments`} aria-label={`Open comments: ${announcement.title}`}>
                  {widget || !announcement.commentCount ? <MessageCircle /> : announcement.commentCount}
                </Link>
              </Button>
            </Tooltip>
          ) : null}
          {canPin || canArchiveAnnouncement ? (
            <DropdownMenu>
              <DropdownTrigger render={
                <Button id={`announcement-more-${announcement._id}`} variant="ghost" size="icon-sm" aria-label={`More actions: ${announcement.title}`}><Ellipsis /></Button>
              } />
              <DropdownContent align="end">
                {canPin ? <MenuItem index={0} icon={announcement.isPinned ? PinOff : Pin} label={announcement.isPinned ? 'Unpin from your feed' : 'Pin to top for you'} onSelect={() => onPinToggle?.(announcement)} /> : null}
                {canArchiveAnnouncement ? <MenuItem index={canPin ? 1 : 0} icon={Archive} label="Archive announcement" onSelect={() => onArchive?.(announcement._id)} /> : null}
              </DropdownContent>
            </DropdownMenu>
          ) : null}
        </div>
        {footer ? <div className="w-full">{footer}</div> : null}
      </CardFooter>
    </Card>
  );
}

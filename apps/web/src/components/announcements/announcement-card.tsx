import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Archive, Bookmark, Clock, Ellipsis, MessageCircle, Pin, PinOff } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { AnnouncementAudience } from '@/components/announcements/announcement-audience-label';
import type { AnnouncementAudienceInput } from '@/components/announcements/announcement-audience';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
import { AnnouncementAuthor, type AnnouncementAuthorPerson } from '@/components/announcements/announcement-author';
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
  author?: AnnouncementAuthorPerson | null;
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
  const status = {
    PENDING_APPROVAL: { label: 'Pending review', color: 'amber' },
    REJECTED: { label: 'Needs changes', color: 'red' },
    EXPIRED: { label: 'Expired', color: 'gray' },
    ARCHIVED: { label: 'Archived', color: 'gray' },
  }[announcement.status] as { label: string; color: BadgeColor } | undefined;
  const createdAt = new Date(announcement.createdAt);
  const createdAtTimestamp = createdAt.getTime();
  const [createdAtTitle, setCreatedAtTitle] = useState<{ timestamp: number; label: string } | null>(null);
  useEffect(() => {
    setCreatedAtTitle({ timestamp: createdAtTimestamp, label: new Date(createdAtTimestamp).toLocaleString() });
  }, [createdAtTimestamp]);
  const hasClientTime = createdAtTitle?.timestamp === createdAtTimestamp;
  const expiresAt = announcement.expiresAt ? new Date(announcement.expiresAt).getTime() : null;
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  useEffect(() => {
    if (expiresAt === null || !Number.isFinite(expiresAt)) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setExpiredAt(expiresAt);
        return;
      }
      // Browsers clamp longer delays to 1ms. Recheck long-lived posts safely.
      timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    };
    // Determine expiry after hydration so the initial prefix is deterministic.
    checkExpiry();
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const audienceMetadata = <>
    <AnnouncementAudience announcement={announcement} />
    {orderingContext !== 'personal-pins' && announcement.isPinned ? <span>Pinned for you</span> : null}
    {orderingContext !== 'important' && announcement.isPromoted ? <span>Important</span> : null}
    {status ? <Badge variant="solid" size="sm" color={status.color}>{status.label}</Badge> : null}
  </>;
  const canPin = !!onPinToggle && announcement.status === 'ACTIVE';
  const canArchiveAnnouncement = canArchive && !!onArchive && announcement.status === 'ACTIVE';
  const postedTime = <time dateTime={createdAt.toISOString()} title={hasClientTime ? createdAtTitle.label : createdAt.toISOString()}>
    {hasClientTime ? formatDistanceToNow(createdAt, { addSuffix: true }) : createdAt.toISOString().slice(0, 10)}
  </time>;
  const expiry = announcement.expiresAt ? <span className="inline-flex items-center gap-1">
    <Clock aria-hidden className="size-3.5" />
    {expiresAt !== null && expiredAt === expiresAt ? 'Expired' : 'Expires'} {hasClientTime
      ? formatDistanceToNow(new Date(announcement.expiresAt), { addSuffix: true })
      : new Date(announcement.expiresAt).toISOString().slice(0, 10)}
  </span> : null;

  return (
    <Card
      index={index}
      href={`/announcements/${announcement._id}`}
      attention={!announcement.isRead}
      label={`Open announcement: ${announcement.title} (${announcement.isRead ? 'Read' : 'Unread'})`}
      className={cn('announcement-card relative', className)}
      data-read-state={announcement.isRead ? 'read' : 'unread'}
    >
      <CardContent className={widget ? 'px-3 pt-4' : 'px-4 pt-4 sm:px-5'}>
        {!widget ? <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {audienceMetadata}
          <span className="sm:hidden">{postedTime}</span>
          {expiry ? <span className="sm:hidden">{expiry}</span> : null}
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
      <CardFooter className={cn('gap-y-2', widget ? 'px-3 pt-1' : 'px-4 pt-3 sm:px-5')}>
        <div className="flex w-full min-w-0 items-center gap-2">
          {widget ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {audienceMetadata}{postedTime}{expiry}
          </div> : <AnnouncementAuthor author={announcement.author} className="flex-1" detailsClassName="hidden sm:block">
            <span className="flex flex-wrap gap-x-2">{postedTime}{expiry}</span>
          </AnnouncementAuthor>}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Tooltip content={announcement.isRead ? 'Mark unread' : 'Mark read'}>
              <AnnouncementReadToggle announcementId={announcement._id} isRead={announcement.isRead} iconOnly variant="ghost" />
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
              <Tooltip content={announcement.commentCount ? `${announcement.commentCount} comments` : 'Open comments'}>
                <Button asChild variant="ghost" size="icon-sm">
                  <Link href={`/announcements/${announcement._id}#comments`} aria-label={`Open comments: ${announcement.title}${announcement.commentCount ? ` (${announcement.commentCount})` : ''}`}>
                    <MessageCircle />
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
        </div>
        {footer ? <div className="w-full">{footer}</div> : null}
      </CardFooter>
    </Card>
  );
}

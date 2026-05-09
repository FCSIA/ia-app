import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Archive, Bookmark, BookmarkCheck, Clock, MessageCircle, Pin } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { Badge } from '@/components/ui/badge';
import type { BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const ANNOUNCEMENT_BADGE_TEXT_CLASS = 'text-[11px] leading-none';

export const ANNOUNCEMENT_TAG_COLORS: Record<string, string> = {
  SCHOOL_WIDE:
    'border-blue-500/25 bg-blue-500/12 text-blue-700 shadow-blue-500/5 hover:border-blue-500/40 hover:bg-blue-500/20 dark:text-blue-300',
  GRADE:
    'border-violet-500/25 bg-violet-500/12 text-violet-700 shadow-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/20 dark:text-violet-300',
  PATHWAY:
    'border-emerald-500/25 bg-emerald-500/12 text-emerald-700 shadow-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/20 dark:text-emerald-300',
  CLUB:
    'border-amber-500/25 bg-amber-500/12 text-amber-700 shadow-amber-500/5 hover:border-amber-500/40 hover:bg-amber-500/20 dark:text-amber-300',
};

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
  id: string;
  title: string;
  body: string;
  createdAt: string;
  expiresAt?: string | null;
  isRead: boolean;
  isAdminGeneral?: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
  allowComments?: boolean;
  status: string;
  targetType: string;
  author?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  club?: {
    id: string;
    name: string;
  } | null;
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
  onArchive?: (id: string) => void;
  onBookmarkToggle?: (announcement: AnnouncementCardRecord) => void;
  onTagClick?: (tag: string) => void;
  onClubClick?: (clubId: string) => void;
};

function InteractiveBadge({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (!onClick) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex cursor-pointer rounded-full outline-none transition-all duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:ring-1 focus-visible:ring-[#6B97FF]"
      aria-label={ariaLabel}
    >
      <span className="pointer-events-none inline-flex transition-transform duration-150 group-hover:scale-[1.02]">
        {children}
      </span>
    </button>
  );
}

export function AnnouncementCard({
  announcement,
  compact = false,
  canArchive = false,
  className,
  footer,
  onArchive,
  onBookmarkToggle,
  onTagClick,
  onClubClick,
}: AnnouncementCardProps) {
  const authorName = [announcement.author?.firstName, announcement.author?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <Card
      className={cn(
        'relative transition-all duration-200 hover:-translate-y-0.5',
        !announcement.isRead &&
          'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]',
        announcement.isPinned && 'bg-primary/[0.025]',
        className,
      )}
    >
      {!announcement.isRead ? (
        <span className="absolute right-4 top-4 size-2.5 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.14)]" />
      ) : null}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 pr-4">
              {announcement.isAdminGeneral ? (
                <Badge variant="solid" color="red" className={cn(ANNOUNCEMENT_BADGE_TEXT_CLASS, 'transition-all duration-150 hover:-translate-y-px')}>
                  Push notification
                </Badge>
              ) : null}
              {announcement.isPinned ? (
                <Badge variant="solid" color="amber" className={cn(ANNOUNCEMENT_BADGE_TEXT_CLASS, 'gap-1 transition-all duration-150 hover:-translate-y-px')}>
                  <Pin className="size-3" />
                  Pinned
                </Badge>
              ) : null}
              {announcement.isBookmarked ? (
                <Badge variant="dot" color="blue" className={cn(ANNOUNCEMENT_BADGE_TEXT_CLASS, 'gap-1 transition-all duration-150 hover:-translate-y-px')}>
                  <BookmarkCheck className="size-3" />
                  Saved
                </Badge>
              ) : null}
              {announcement.status === 'PENDING_APPROVAL' ? (
                <Badge variant="solid" color="orange" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Pending review
                </Badge>
              ) : null}
              {announcement.status === 'REJECTED' ? (
                <Badge variant="dot" color="red" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Needs changes
                </Badge>
              ) : null}
              {announcement.status === 'EXPIRED' ? (
                <Badge variant="solid" color="gray" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Expired
                </Badge>
              ) : null}
              {announcement.status === 'ARCHIVED' ? (
                <Badge variant="dot" color="gray" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Archived
                </Badge>
              ) : null}
              <InteractiveBadge
                ariaLabel={`Filter announcements by ${ANNOUNCEMENT_TAG_LABELS[announcement.targetType] ?? announcement.targetType}`}
                onClick={onTagClick ? () => onTagClick(announcement.targetType) : undefined}
              >
                <Badge
                  color={ANNOUNCEMENT_TAG_BADGE_COLORS[announcement.targetType] ?? 'gray'}
                  className={cn(
                    ANNOUNCEMENT_BADGE_TEXT_CLASS,
                    'shadow-sm transition-all duration-150',
                    onTagClick ? 'cursor-pointer' : '',
                    ANNOUNCEMENT_TAG_COLORS[announcement.targetType] || 'bg-muted text-muted-foreground',
                  )}
                >
                  {ANNOUNCEMENT_TAG_LABELS[announcement.targetType] ||
                    announcement.targetType.replace(/_/g, ' ')}
                </Badge>
              </InteractiveBadge>
              {announcement.club?.name ? (
                <InteractiveBadge
                  ariaLabel={`Filter announcements by ${announcement.club.name}`}
                  onClick={onClubClick ? () => onClubClick(announcement.club!.id) : undefined}
                >
                  <Badge
                    variant="dot"
                    color="emerald"
                    className={cn(
                      ANNOUNCEMENT_BADGE_TEXT_CLASS,
                      'transition-all duration-150 hover:-translate-y-px hover:bg-emerald-500/10',
                      onClubClick ? 'cursor-pointer' : '',
                    )}
                  >
                    {announcement.club.name}
                  </Badge>
                </InteractiveBadge>
              ) : null}
            </div>

            <Link href={`/announcements/${announcement.id}`}>
              <h3
                className={cn(
                  'font-semibold text-foreground/90 transition-colors hover:text-accent-500',
                  compact ? 'line-clamp-1 text-sm' : 'line-clamp-2',
                )}
              >
                {announcement.title}
              </h3>
            </Link>

            <p className={cn('mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground')}>
              {announcement.body}
            </p>

            <p className={cn('mt-3 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
              {authorName || 'Unknown author'} ·{' '}
              {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
              {announcement.expiresAt ? (
                <span className="ml-2 text-amber-500 dark:text-amber-400">
                  <Clock size={12} className="mr-1 inline" />
                  expires {formatDistanceToNow(new Date(announcement.expiresAt), { addSuffix: true })}
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {announcement.allowComments ? (
              <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">
                <MessageCircle size={14} /> {announcement._count?.comments || 0}
              </span>
            ) : null}
            <AnnouncementReadToggle announcementId={announcement.id} isRead={announcement.isRead} />
            {onBookmarkToggle ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onBookmarkToggle(announcement)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={announcement.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                {announcement.isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </Button>
            ) : null}
            {canArchive && announcement.status === 'ACTIVE' && onArchive ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchive(announcement.id)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Archive"
              >
                <Archive size={16} />
              </Button>
            ) : null}
          </div>
        </div>

        {footer ? <div className="mt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

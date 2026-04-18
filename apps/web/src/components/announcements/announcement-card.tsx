import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Archive, Clock, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const ANNOUNCEMENT_BADGE_TEXT_CLASS = 'text-[11px] leading-none';

export const ANNOUNCEMENT_TAG_COLORS: Record<string, string> = {
  SCHOOL_WIDE:
    'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 border-transparent',
  GRADE:
    'bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-500/25 border-transparent',
  PATHWAY:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-transparent',
  CLUB:
    'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-transparent',
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
    <button type="button" onClick={onClick} className="inline-flex cursor-pointer" aria-label={ariaLabel}>
      <span className="pointer-events-none">{children}</span>
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
        announcement.isRead
          ? ''
          : 'border-sky-500/25 bg-slate-100/95 dark:border-sky-300/20 dark:bg-slate-800/75',
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
                <Badge variant="destructive" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Admin
                </Badge>
              ) : null}
              {announcement.status === 'EXPIRED' ? (
                <Badge variant="secondary" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Expired
                </Badge>
              ) : null}
              {announcement.status === 'ARCHIVED' ? (
                <Badge variant="outline" className={ANNOUNCEMENT_BADGE_TEXT_CLASS}>
                  Archived
                </Badge>
              ) : null}
              <InteractiveBadge
                ariaLabel={`Filter announcements by ${ANNOUNCEMENT_TAG_LABELS[announcement.targetType] ?? announcement.targetType}`}
                onClick={onTagClick ? () => onTagClick(announcement.targetType) : undefined}
              >
                <Badge
                  className={cn(
                    ANNOUNCEMENT_BADGE_TEXT_CLASS,
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
                    variant="outline"
                    className={cn(
                      ANNOUNCEMENT_BADGE_TEXT_CLASS,
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

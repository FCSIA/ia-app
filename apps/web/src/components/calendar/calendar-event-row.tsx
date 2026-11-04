'use client';
import { format } from 'date-fns';
import { displayName, type PersonName } from '~/apps/shared/user-name';
import { useIcon, type IconName } from '@/lib/icon-context';
import { cn } from '@/lib/utils';
import { calendarDate } from './calendar-date';

export const CALENDAR_SOURCES = {
  PERSONAL: { label: 'Personal', color: 'var(--color-violet-500)', icon: 'user' },
  SCHOOL: { label: 'School', color: 'var(--color-blue-500)', icon: 'home' },
  DISTRICT: { label: 'District', color: 'var(--color-rose-500)', icon: 'globe' },
  CLUB: { label: 'Clubs', color: 'var(--color-amber-500)', icon: 'users' },
  FLEX_FRIDAY: { label: 'Flex Friday', color: 'var(--color-emerald-500)', icon: 'star' },
  EXTERNAL: { label: 'Connected', color: 'var(--color-teal-500)', icon: 'link' },
} as const satisfies Record<string, { label: string; color: string; icon: IconName }>;

export type CalendarSource = keyof typeof CALENDAR_SOURCES;

/** The source's icon in its calendar color; shared by agenda rows and the source filter. */
export function CalendarSourceIcon({
  source,
  className,
}: {
  source: CalendarSource;
  className?: string;
}) {
  const Icon = useIcon(CALENDAR_SOURCES[source].icon);
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0', className)}
      style={{ color: CALENDAR_SOURCES[source].color }}
    >
      <Icon size={14} strokeWidth={2} />
    </span>
  );
}

/**
 * The shared agenda anatomy used by the calendar and dashboard. A narrow time
 * column stacks start over end; long titles wrap to two lines rather than
 * truncating. Wide rows keep metadata beside the title; narrow containers
 * (phone, side rail) stack it underneath.
 */
export function CalendarEventRow({
  entry,
  start,
  end,
  allDay,
}: {
  entry: {
    title: string;
    source: CalendarSource;
    location?: string;
    sharedBy?: PersonName;
  };
  start: Date;
  end?: Date;
  allDay?: boolean;
}) {
  const source = CALENDAR_SOURCES[entry.source];
  // Your own reminders need no source label; the dot already carries it.
  const meta = [
    entry.sharedBy
      ? `Shared by ${displayName(entry.sharedBy)}`
      : entry.source === 'PERSONAL'
        ? null
        : source.label,
    entry.location,
  ]
    .filter(Boolean)
    .join(' · ');
  // Deadlines (Canvas assignments, due items) arrive with end === start.
  const showEnd = end && end.getTime() !== start.getTime();
  return (
    <span className="@container block w-full min-w-0">
      <span className="flex w-full min-w-0 items-start gap-3 text-sm">
        <span className="w-16 shrink-0 text-xs leading-5 tabular-nums text-muted-foreground">
          {allDay ? (
            'All day'
          ) : (
            <>
              <span className="block whitespace-nowrap">
                {format(calendarDate(start), 'h:mm a')}
              </span>
              {showEnd ? (
                <span className="block whitespace-nowrap">
                  {format(calendarDate(end), 'h:mm a')}
                </span>
              ) : null}
            </>
          )}
        </span>
        <CalendarSourceIcon source={entry.source} className="mt-[3px]" />
        <span className="flex min-w-0 flex-1 flex-col @xl:flex-row @xl:items-baseline @xl:gap-3">
          <span className="line-clamp-2 min-w-0 break-words font-medium leading-5">
            {entry.title}
          </span>
          {meta ? (
            <span className="min-w-0 truncate text-xs leading-5 text-muted-foreground @xl:max-w-[40%] @xl:shrink-0">
              {meta}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

import { format } from 'date-fns';
import { displayName, type PersonName } from '~/apps/shared/user-name';
import { calendarDate } from './calendar-date';

export const CALENDAR_SOURCES = {
  PERSONAL: { label: 'Personal', color: 'var(--color-violet-500)' },
  SCHOOL: { label: 'School', color: 'var(--color-blue-500)' },
  DISTRICT: { label: 'District', color: 'var(--color-rose-500)' },
  CLUB: { label: 'Clubs', color: 'var(--color-amber-500)' },
  FLEX_FRIDAY: { label: 'Flex Friday', color: 'var(--color-emerald-500)' },
  EXTERNAL: { label: 'Connected', color: 'var(--color-teal-500)' },
} as const;

export type CalendarSource = keyof typeof CALENDAR_SOURCES;

/**
 * The shared agenda anatomy used by the calendar and dashboard. Wide rows keep
 * time, title and metadata on one line; narrow containers (phone, side rail,
 * widget) stack the metadata under the title.
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
  return (
    <span className="@container block w-full min-w-0">
      <span className="flex w-full min-w-0 items-start gap-3 text-sm @xl:items-center">
        <span className="w-20 shrink-0 text-xs leading-5 tabular-nums text-muted-foreground @xl:w-36">
          {allDay ? (
            'All day'
          ) : (
            <>
              <span className="whitespace-nowrap">
                {format(calendarDate(start), 'h:mm a')}
              </span>
              {end ? (
                <span className="block whitespace-nowrap @xl:inline">{` – ${format(calendarDate(end), 'h:mm a')}`}</span>
              ) : null}
            </>
          )}
        </span>
        <span
          aria-hidden="true"
          className="mt-1.5 size-2 shrink-0 rounded-full @xl:mt-0"
          style={{ backgroundColor: source.color }}
        />
        <span className="flex min-w-0 flex-1 flex-col @xl:flex-row @xl:items-baseline @xl:gap-3">
          <span className="min-w-0 truncate font-medium leading-5">
            {entry.title}
          </span>
          {meta ? (
            <span className="min-w-0 truncate text-xs leading-5 text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

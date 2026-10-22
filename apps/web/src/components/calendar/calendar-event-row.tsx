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

/** The shared agenda anatomy used by the calendar and dashboard. */
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
  return (
    <span className="flex w-full min-w-0 items-start gap-3 py-1 text-sm">
      <span className="w-20 shrink-0 text-xs leading-5 tabular-nums text-muted-foreground sm:w-28">
        {allDay ? (
          'All day'
        ) : (
          <>
            {format(calendarDate(start), 'h:mm a')}
            {end ? (
              <span className="block sm:inline">{` – ${format(calendarDate(end), 'h:mm a')}`}</span>
            ) : null}
          </>
        )}
      </span>
      <span
        aria-hidden="true"
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: source.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5">
          {entry.title}
        </span>
        <span className="block truncate text-xs leading-5 text-muted-foreground">
          {entry.sharedBy
            ? `Shared by ${displayName(entry.sharedBy)}`
            : source.label}
          {entry.location ? ` · ${entry.location}` : ''}
        </span>
      </span>
    </span>
  );
}

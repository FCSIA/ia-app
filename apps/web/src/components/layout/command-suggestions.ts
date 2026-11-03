import { format, startOfDay } from 'date-fns';
import { calendarDate } from '../calendar/calendar-date';

export const COMMAND_AGENDA_DAYS = 14;
const DAY = 86_400_000;

export function personalCommandQueryArgs({
  open,
  isAuthenticated,
  hasUser,
  now,
}: {
  open: boolean;
  isAuthenticated: boolean;
  hasUser: boolean;
  now: number;
}) {
  const enabled = open && isAuthenticated && hasUser;
  return {
    workshops: enabled ? { now, limit: 10 } : 'skip' as const,
    calendar: enabled ? {
      startDate: startOfDay(calendarDate(now)).getTime(),
      endDate: now + COMMAND_AGENDA_DAYS * DAY,
      sources: ['PERSONAL', 'EXTERNAL'],
    } : 'skip' as const,
    events: enabled ? { from: now, to: now + COMMAND_AGENDA_DAYS * DAY, limit: 20 } : 'skip' as const,
    needsYou: enabled ? {} : 'skip' as const,
  };
}

export type CommandSuggestion = {
  id: string;
  href: string;
  kind: 'workshop' | 'commitment' | 'event' | 'task' | 'unread';
  startAt?: number;
  endAt?: number;
  expiresAt?: number;
  createdAt?: number;
};

/** Time-sensitive commitments lead; review tasks and unread items stay bounded. */
export function rankCommandSuggestions(candidates: readonly CommandSuggestion[], now: number, limit = 8) {
  if (limit <= 0) return [];
  const priority = (item: CommandSuggestion) => {
    if (item.kind === 'workshop' || item.kind === 'commitment') return (item.startAt ?? Infinity) < now + DAY ? 0 : 3;
    if (item.kind === 'event') return (item.startAt ?? Infinity) < now + DAY ? 1 : 5;
    return item.kind === 'task' ? 2 : 4;
  };
  const eligible = candidates.filter((item) => {
    if (item.expiresAt !== undefined && item.expiresAt <= now) return false;
    if (item.kind === 'workshop' || item.kind === 'commitment' || item.kind === 'event') {
      return typeof item.startAt === 'number' && Number.isFinite(item.startAt) &&
        (item.endAt ?? item.startAt) > now &&
        (item.kind === 'workshop' || item.startAt <= now + COMMAND_AGENDA_DAYS * DAY);
    }
    return true;
  }).sort((left, right) => {
    const order = priority(left) - priority(right);
    if (order) return order;
    if (left.startAt !== undefined || right.startAt !== undefined) {
      const chronological = (left.startAt ?? Infinity) - (right.startAt ?? Infinity);
      if (chronological) return chronological;
    }
    return (right.createdAt ?? 0) - (left.createdAt ?? 0) || left.id.localeCompare(right.id);
  });
  const ids = new Set<string>();
  const hrefs = new Set<string>();
  let tasks = 0;
  let unread = 0;
  const result: string[] = [];
  for (const item of eligible) {
    if (ids.has(item.id) || hrefs.has(item.href)) continue;
    if (item.kind === 'task' && tasks >= 2) continue;
    if (item.kind === 'unread' && unread >= 3) continue;
    ids.add(item.id);
    hrefs.add(item.href);
    tasks += Number(item.kind === 'task');
    unread += Number(item.kind === 'unread');
    result.push(item.id);
    if (result.length >= limit) break;
  }
  return result;
}

export type WorkshopSuggestionSource = {
  workshopId: string;
  sessions: { _id: string; startAt: number; endAt: number }[];
  registered: boolean;
  assigned: boolean;
  teaching: boolean;
};

/** One suggestion per workshop, ranked by its next uncompleted linked session. */
export function upcomingWorkshopMoments(workshops: readonly WorkshopSuggestionSource[], now: number) {
  const byWorkshop = new Map<string, WorkshopSuggestionSource>();
  for (const workshop of workshops) {
    const previous = byWorkshop.get(workshop.workshopId);
    byWorkshop.set(workshop.workshopId, {
      ...workshop,
      registered: workshop.registered || !!previous?.registered,
      assigned: workshop.assigned || !!previous?.assigned,
      teaching: workshop.teaching || !!previous?.teaching,
      sessions: [...(previous?.sessions ?? []), ...workshop.sessions],
    });
  }
  return [...byWorkshop.values()].flatMap((workshop) => {
    const sessions = [...new Map(workshop.sessions.map((session) => [session._id, session])).values()]
      .filter((session) => Number.isFinite(session.startAt) && session.endAt > session.startAt)
      .sort((left, right) => left.startAt - right.startAt || left._id.localeCompare(right._id));
    const next = sessions.find((session) => session.endAt > now);
    if (!next || !(workshop.registered || workshop.assigned || workshop.teaching)) return [];
    return [{
      ...workshop,
      sessions,
      startAt: next.startAt,
      endAt: next.endAt,
    }];
  }).sort((left, right) => left.startAt - right.startAt || left.workshopId.localeCompare(right.workshopId));
}

export function commandWhen(timestamp: number, now: number, use24HourTime = false, allDay = false) {
  const date = calendarDate(timestamp);
  const dateLabel = format(date, 'yyyy-MM-dd') === format(calendarDate(now), 'yyyy-MM-dd')
    ? 'Today'
    : format(date, 'EEE, MMM d');
  return `${dateLabel} · ${allDay ? 'All day' : format(date, use24HourTime ? 'HH:mm' : 'h:mm a')}`;
}

export function mergeCommandEntities<T extends { _id: string }>(...groups: readonly (readonly T[] | undefined)[]) {
  return [...new Map(groups.flatMap((group) => group ?? []).map((item) => [item._id, item])).values()];
}

export function canSuggestFridayBrowse(
  friday: { _id: string; date: number } | undefined,
  personal: {
    student: boolean;
    hasMore: boolean;
    friday: { _id: string; date: number } | null;
    items: { registered: boolean; assigned: boolean }[];
  } | undefined,
  now: number,
) {
  if (!friday || !personal?.student || personal.hasMore) return false;
  const today = format(calendarDate(now), 'yyyy-MM-dd');
  if (format(calendarDate(friday.date), 'yyyy-MM-dd') <= today || friday.date - now > 7 * DAY) return false;
  // The nearest-personal query cannot prove a later Friday unbooked when an
  // earlier booked Friday was returned. Nor can it prove anything if truncated.
  if (personal.friday && personal.friday.date < friday.date) return false;
  return personal.friday?._id !== friday._id || !personal.items.some((item) => item.registered || item.assigned);
}

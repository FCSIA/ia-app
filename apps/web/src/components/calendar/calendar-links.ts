import { CALENDAR_HREF, eventHref, FLEX_FRIDAY_HREF } from '~/apps/shared/routes';

type CalendarLinkEntry = {
  source?: string;
  eventId?: string | null;
  flexFridayId?: string | null;
  url?: string | null;
};

/** The calendar page's detail card: a connected feed's own link first, then the event or Flex Friday; none otherwise. */
export function calendarDetailHref(entry: CalendarLinkEntry): string | null {
  if (entry.source === 'EXTERNAL') return entry.url ?? null;
  if (entry.eventId) return eventHref(entry.eventId);
  if (entry.flexFridayId) return FLEX_FRIDAY_HREF;
  return null;
}

/** The dashboard widget: an in-app event or Flex Friday first, then an external link, and otherwise that day on the calendar. */
export function calendarWidgetHref(entry: CalendarLinkEntry, dateKey: string): string {
  if (entry.eventId) return eventHref(entry.eventId);
  if (entry.flexFridayId) return FLEX_FRIDAY_HREF;
  if (entry.url) return entry.url;
  return `${CALENDAR_HREF}?date=${dateKey}`;
}

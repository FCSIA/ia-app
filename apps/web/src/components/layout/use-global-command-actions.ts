import { displayName, nameSearchValues } from '~/apps/shared/user-name';
import { useMemo } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import type { FunctionReturnType } from 'convex/server';
import {
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Hash,
  Megaphone,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { hasRole, type AppUser } from '@/lib/auth';
import { useClubEntryHref } from '@/components/clubs/use-club-entry-href';
import { calendarDate, calendarInputDate } from '@/components/calendar/calendar-date';
import { schoolDateKey } from '@/lib/school-date';
import { formatSchoolTime } from '@/lib/time-format';
import {
  commandWhen,
  canSuggestFridayBrowse,
  mergeCommandEntities,
  upcomingWorkshopMoments,
  type CommandSuggestion,
} from './command-suggestions';

export type CommandAction = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  Icon: LucideIcon;
  keywords?: string[];
  badge?: string;
  suggestion?: Omit<CommandSuggestion, 'id' | 'href'>;
};

type PaletteData = {
  announcements: FunctionReturnType<typeof api.announcements.feed.list> | undefined;
  clubs: FunctionReturnType<typeof api.clubs.management.getAll> | undefined;
  courses: FunctionReturnType<typeof api.courses.catalog.list> | undefined;
  events: FunctionReturnType<typeof api.events.events.list> | undefined;
  upcomingEvents: FunctionReturnType<typeof api.events.events.upcoming> | undefined;
  calendarEntries: FunctionReturnType<typeof api.events.calendar.list> | undefined;
  personalWorkshops: FunctionReturnType<typeof api.flexFriday.workshops.upcomingPersonal> | undefined;
  needsYou: FunctionReturnType<typeof api.dashboard.needsYou.list> | undefined;
  flexFridays: FunctionReturnType<typeof api.flexFriday.fridays.list> | undefined;
  globalResults: FunctionReturnType<typeof api.search.global.palette> | undefined;
  myClubIds: Set<string>;
  notifications: FunctionReturnType<typeof api.notifications.inbox.list> | undefined;
  schedule: FunctionReturnType<typeof api.schedule.dashboard.get> | undefined;
  user: AppUser | null;
  now: number;
};

export function useGlobalCommandActions({
  announcements,
  clubs,
  courses,
  events,
  upcomingEvents,
  calendarEntries,
  personalWorkshops,
  needsYou,
  flexFridays,
  globalResults,
  myClubIds,
  notifications,
  schedule,
  user,
  now,
}: PaletteData) {
  const clubEntryHref = useClubEntryHref();

  return useMemo(() => {
    const joinedClubs = (clubs ?? [])
      .filter((club) => myClubIds.has(club._id))
      .slice(0, 12)
      .map((club) => ({
        id: `my-club-${club._id}`,
        label: club.name,
        detail: 'Club workspace',
        href: clubEntryHref(club._id),
        Icon: UsersRound,
        badge: 'Joined',
        keywords: ['my club', 'joined club', club.name, club.description ?? ''],
      }));

    const clubActions: CommandAction[] = (clubs ?? [])
      .filter((club) => !myClubIds.has(club._id))
      .slice(0, 24)
      .map((club) => ({
        id: `club-${club._id}`,
        label: club.name,
        detail: club.description || 'Club workspace',
        href: clubEntryHref(club._id),
        Icon: UsersRound,
        keywords: ['club', club.name, club.description ?? ''],
      }));

    const announcementActions: CommandAction[] = (announcements ?? [])
      .slice(0, 18)
      .map((announcement) => ({
        id: `announcement-${announcement._id}`,
        label: announcement.title,
        detail:
          announcement.club?.name ||
          announcement.targetType?.replace(/_/g, ' ') ||
          'Announcement',
        href: `/announcements/${announcement._id}`,
        Icon: Megaphone,
        badge: announcement.isRead ? undefined : 'Unread',
        suggestion: announcement.isRead || announcement.status !== 'ACTIVE' ? undefined : {
          kind: 'unread',
          createdAt: announcement.createdAt,
          expiresAt: announcement.expiresAt,
        },
        keywords: ['announcement', announcement.body, announcement.club?.name].filter(
          (value): value is string => !!value,
        ),
      }));

    const eventActions: CommandAction[] = mergeCommandEntities(upcomingEvents, events).slice(0, 45).map((event) => ({
      id: `event-${event._id}`,
      label: event.title,
      detail: [commandWhen(event.startAt, now, user?.use24HourTime), event.location, event.club?.name].filter(Boolean).join(' · '),
      href: `/events/${event._id}`,
      Icon: Ticket,
      suggestion: event.status === 'PUBLISHED' && !event.isInactive ? {
        kind: 'event', startAt: event.startAt, endAt: event.endAt,
      } : undefined,
      keywords: ['event', event.description, event.location, event.club?.name].filter(
        (value): value is string => !!value,
      ),
    }));

    const courseActions: CommandAction[] = (courses ?? []).slice(0, 25).map((course) => ({
      id: `course-${course.slug}`,
      label: course.title,
      detail:
        [course.department, course.pathway?.replace(/_/g, ' ')].filter(Boolean).join(' · ') ||
        'Course',
      href: `/courses/${course.slug}`,
      Icon: BookOpen,
      keywords: ['course', course.department, course.courseNumbers.join(' ')],
    }));

    const notificationActions: CommandAction[] = (notifications ?? [])
      .slice(0, 15)
      .map((notification) => ({
        id: `notification-${notification.id}`,
        label: notification.title,
        detail: notification.body || notification.category.replace(/_/g, ' '),
        href: notification.href,
        Icon: Bell,
        badge: notification.isRead ? undefined : 'Unread',
        suggestion: notification.isRead ? undefined : { kind: 'unread', createdAt: Date.parse(notification.createdAt) },
        keywords: ['notification', notification.category, notification.body],
      }));

    const futureFridays = (flexFridays ?? [])
      .filter((friday) => schoolDateKey(new Date(friday.date)) >= schoolDateKey(new Date(now)))
      .sort((left, right) => left.date - right.date);
    const flexActions: CommandAction[] = futureFridays.slice(0, 10).map((friday) => ({
      id: `flex-${friday._id}`,
      label: `Flex Friday ${format(calendarDate(friday.date), 'EEE, MMM d')}`,
      detail: friday.type.replace(/_/g, ' ') || 'Workshop day',
      href: `/flex-friday?friday=${friday._id}`,
      Icon: Sparkles,
      keywords: ['flex friday', friday.notes, friday.type].filter(
        (value): value is string => !!value,
      ),
    }));

    const workshopMoments = upcomingWorkshopMoments(personalWorkshops?.items ?? [], now);
    const workshops: CommandAction[] = personalWorkshops?.friday ? workshopMoments.map((moment) => {
      const workshop = personalWorkshops.items.find((item) => item.workshopId === moment.workshopId)!;
      const date = commandWhen(moment.startAt, now, user?.use24HourTime).split(' · ')[0];
      const times = moment.sessions.map((session) => {
        const start = format(calendarDate(session.startAt), user?.use24HourTime ? 'HH:mm' : 'h:mm a');
        const end = format(calendarDate(session.endAt), user?.use24HourTime ? 'HH:mm' : 'h:mm a');
        return `${start}–${end}`;
      }).join(' / ');
      const reason = moment.teaching ? 'You teach' : moment.assigned ? 'Assigned to you' : 'Registered';
      return {
        id: `workshop-${personalWorkshops.friday!._id}-${workshop.workshopId}`,
        label: workshop.title,
        detail: [reason, date, times, workshop.location].filter(Boolean).join(' · '),
        href: `/flex-friday/${personalWorkshops.friday!._id}/workshop/${workshop.workshopId}`,
        Icon: Sparkles,
        keywords: ['workshop', 'flex friday', reason, times, workshop.location ?? '',
          ...workshop.sessions.flatMap((session) => [session.title, session.description ?? '', session.startTime, session.endTime])],
        suggestion: { kind: 'workshop', startAt: moment.startAt, endAt: moment.endAt },
      };
    }) : [];

    const calendar: CommandAction[] = (calendarEntries ?? []).map((entry) => ({
      id: `calendar-${entry._id}`,
      label: entry.title,
      detail: [
        commandWhen(entry.startAt, now, user?.use24HourTime, entry.allDay),
        'sharedBy' in entry && entry.sharedBy ? `Shared by ${displayName(entry.sharedBy)}` : entry.source === 'EXTERNAL' ? 'Your calendar feed' : 'Your calendar',
        entry.location,
      ].filter(Boolean).join(' · '),
      href: `/calendar?view=agenda&date=${schoolDateKey(new Date(Math.max(now, entry.startAt)))}`,
      Icon: CalendarRange,
      keywords: ['calendar', 'reminder', entry.description ?? '', entry.location ?? '', ...entry.tags],
      suggestion: {
        kind: 'commitment', startAt: entry.startAt,
        endAt: entry.endAt ?? (entry.allDay ? addDays(startOfDay(calendarDate(entry.startAt)), 1).getTime() : undefined),
      },
    }));

    const taskReasons = {
      announcement: 'Awaiting your approval', event: 'Awaiting your approval',
      invite: 'Calendar invitation', 'club-invite': 'Club invitation',
      changes: 'Changes requested', reports: 'Moderation review', feedback: 'Feedback to review',
    };
    const tasks: CommandAction[] = (needsYou?.items ?? []).slice(0, 8).map((item) => ({
      id: `needs-you-${item.id}`,
      label: item.title,
      detail: taskReasons[item.kind],
      href: item.href,
      Icon: ClipboardCheck,
      keywords: ['needs you', 'review', taskReasons[item.kind]],
      suggestion: { kind: 'task', createdAt: item.createdAt },
    }));
    const nextFriday = futureFridays.find((friday) => friday._count.sessions > 0);
    if (nextFriday && canSuggestFridayBrowse(nextFriday, personalWorkshops, now)) {
      tasks.push({
        id: `browse-workshops-${nextFriday._id}`,
        label: 'Browse Friday workshops',
        detail: `${format(calendarDate(nextFriday.date), 'EEE, MMM d')} · No workshop booked`,
        href: `/flex-friday?friday=${nextFriday._id}`,
        Icon: Sparkles,
        keywords: ['register', 'workshops', 'flex friday'],
        suggestion: { kind: 'task', expiresAt: calendarInputDate(`${schoolDateKey(new Date(nextFriday.date))}T23:59`).getTime() },
      });
    }

    const day = schedule?.resolvedDay;
    const nextBlock = day?.blocks.find((block) => calendarInputDate(`${day.dateKey}T${block.endTime}`).getTime() > now);
    const todaySchedule: CommandAction[] = day && nextBlock && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN') ? [{
      id: `today-schedule-${day.dateKey}`,
      label: `${format(calendarInputDate(day.dateKey), 'EEEE')} schedule`,
      detail: [day.name, nextBlock.entry?.className || nextBlock.label,
        formatSchoolTime(nextBlock.startTime, user?.use24HourTime)].filter(Boolean).join(' · '),
      href: '/schedule?tab=mine',
      Icon: ClipboardList,
      keywords: ['today', 'schedule', 'next class', day.name],
      suggestion: {
        kind: 'commitment',
        startAt: calendarInputDate(`${day.dateKey}T${nextBlock.startTime}`).getTime(),
        endAt: calendarInputDate(`${day.dateKey}T${nextBlock.endTime}`).getTime(),
      },
    }] : [];

    const scheduleActions: CommandAction[] = (schedule?.friends ?? []).slice(0, 12).map((friend) => ({
      id: `schedule-friend-${friend.id}`,
      label: displayName(friend.user),
      detail: 'Schedule friend',
      href: '/schedule?tab=friends',
      Icon: Users,
      keywords: ['schedule friend', friend.user.uniqueId, ...nameSearchValues(friend.user)],
    }));

    const peopleActions: CommandAction[] = (globalResults?.people ?? []).map((person) => ({
      id: `person-${person._id}`,
      label: displayName(person),
      detail: 'IA community member',
      href: hasRole(user, 'STUDENT')
        ? `/schedule?tab=friends&search=${encodeURIComponent(displayName(person))}`
        : `/admin?search=${encodeURIComponent(displayName(person))}`,
      Icon: UserRound,
      keywords: ['person', 'people', ...nameSearchValues(person)],
    }));

    const channelActions: CommandAction[] = (globalResults?.channels ?? []).map((channel) => ({
      id: `channel-${channel._id}`,
      label: `${channel.name}`,
      detail: channel.club.name,
      href: `/clubs/${channel.club._id}/channels/${channel._id}`,
      Icon: Hash,
      keywords: ['channel', 'club channel', channel.club.name, channel.description ?? ''],
    }));

    return {
      joinedClubs,
      announcements: announcementActions,
      clubs: clubActions,
      events: eventActions,
      courses: courseActions,
      notifications: notificationActions,
      flex: flexActions,
      schedule: scheduleActions,
      people: peopleActions,
      channels: channelActions,
      workshops,
      calendar,
      tasks,
      todaySchedule,
      hasStudentBooking: !!personalWorkshops?.student && workshopMoments.some((item) => item.registered || item.assigned),
    };
  }, [
    announcements,
    clubs,
    clubEntryHref,
    courses,
    events,
    upcomingEvents,
    calendarEntries,
    personalWorkshops,
    needsYou,
    flexFridays,
    globalResults,
    myClubIds,
    notifications,
    schedule,
    user,
    now,
  ]);
}

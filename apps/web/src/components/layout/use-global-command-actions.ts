import { displayName, nameSearchValues } from '~/apps/shared/user-name';
import { useMemo } from 'react';
import { format } from 'date-fns';
import type { FunctionReturnType } from 'convex/server';
import {
  Bell,
  BookOpen,
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

export type CommandAction = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  Icon: LucideIcon;
  keywords?: string[];
  badge?: string;
};

type PaletteData = {
  announcements: FunctionReturnType<typeof api.announcements.feed.list> | undefined;
  clubs: FunctionReturnType<typeof api.clubs.management.getAll> | undefined;
  courses: FunctionReturnType<typeof api.courses.catalog.list> | undefined;
  events: FunctionReturnType<typeof api.events.events.list> | undefined;
  flexFridays: FunctionReturnType<typeof api.flexFriday.fridays.list> | undefined;
  globalResults: FunctionReturnType<typeof api.search.global.palette> | undefined;
  myClubIds: Set<string>;
  notifications: FunctionReturnType<typeof api.notifications.inbox.list> | undefined;
  schedule: FunctionReturnType<typeof api.schedule.dashboard.get> | undefined;
  user: AppUser | null;
};

export function useGlobalCommandActions({
  announcements,
  clubs,
  courses,
  events,
  flexFridays,
  globalResults,
  myClubIds,
  notifications,
  schedule,
  user,
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

    const unreadAnnouncements = (announcements ?? [])
      .filter((announcement) => !announcement.isRead)
      .slice(0, 8)
      .map((announcement) => ({
        id: `announcement-${announcement._id}`,
        label: announcement.title,
        detail:
          announcement.club?.name ||
          announcement.targetType?.replace(/_/g, ' ') ||
          'Announcement',
        href: `/announcements/${announcement._id}`,
        Icon: Megaphone,
        badge: 'Unread',
        keywords: ['unread', 'announcement', announcement.body, announcement.club?.name].filter(
          (value): value is string => !!value,
        ),
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
        keywords: ['announcement', announcement.body, announcement.club?.name].filter(
          (value): value is string => !!value,
        ),
      }));

    const eventActions: CommandAction[] = (events ?? []).slice(0, 25).map((event) => ({
      id: `event-${event._id}`,
      label: event.title,
      detail: [event.location, event.club?.name].filter(Boolean).join(' · ') || 'Event',
      href: `/events/${event._id}`,
      Icon: Ticket,
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
        badge: 'Unread',
        keywords: ['notification', notification.category, notification.body],
      }));

    const flexActions: CommandAction[] = (flexFridays ?? []).slice(0, 10).map((friday) => ({
      id: `flex-${friday._id}`,
      label: `Flex Friday ${format(new Date(friday.date), 'yyyy-MM-dd')}`,
      detail: friday.type.replace(/_/g, ' ') || 'Workshop day',
      href: `/flex-friday?friday=${friday._id}`,
      Icon: Sparkles,
      keywords: ['flex friday', friday.notes, friday.type].filter(
        (value): value is string => !!value,
      ),
    }));

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
      unreadAnnouncements,
      announcements: announcementActions,
      clubs: clubActions,
      events: eventActions,
      courses: courseActions,
      notifications: notificationActions,
      flex: flexActions,
      schedule: scheduleActions,
      people: peopleActions,
      channels: channelActions,
    };
  }, [
    announcements,
    clubs,
    clubEntryHref,
    courses,
    events,
    flexFridays,
    globalResults,
    myClubIds,
    notifications,
    schedule,
    user,
  ]);
}

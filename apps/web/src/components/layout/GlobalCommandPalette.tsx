'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery as useRestQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import {
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Home,
  Megaphone,
  PanelTop,
  Puzzle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Ticket,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  announcementsApi,
  eventsApi,
  flexFridayApi,
} from '@/lib/api';
import { api } from '~/apps/convex/src/_generated/api';
import { hasRole, type AppUser } from '@/lib/auth';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

type CommandAction = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  Icon: LucideIcon;
  keywords?: string[];
  badge?: string;
};

const staticActions: CommandAction[] = [
  { id: 'route-dashboard', label: 'Dashboard', detail: 'Home and widgets', href: '/dashboard', Icon: Home },
  { id: 'route-announcements', label: 'Announcements', detail: 'Official updates', href: '/announcements', Icon: Megaphone },
  { id: 'route-clubs', label: 'Clubs', detail: 'Directory and workspaces', href: '/clubs', Icon: Puzzle },
  { id: 'route-schedule', label: 'Schedule', detail: 'Classes and friends', href: '/schedule', Icon: ClipboardList },
  { id: 'route-events', label: 'Events', detail: 'School and club events', href: '/events', Icon: Ticket },
  { id: 'route-calendar', label: 'Calendar', detail: 'Shared calendar', href: '/calendar', Icon: CalendarRange },
  { id: 'route-courses', label: 'Courses', detail: 'Course catalog', href: '/courses', Icon: BookOpen },
  { id: 'route-flex', label: 'Flex Friday', detail: 'Workshops and passes', href: '/flex-friday', Icon: Sparkles },
  { id: 'route-pass', label: 'My Pass', detail: 'Flex Friday pass', href: '/flex-friday/pass', Icon: PanelTop },
  { id: 'route-notifications', label: 'Notifications', detail: 'Inbox and settings', href: '/notifications', Icon: Bell },
  { id: 'route-profile', label: 'Profile Settings', detail: 'Account and preferences', href: '/profile', Icon: Settings },
];

const pageOrder = [
  'route-dashboard',
  'route-announcements',
  'route-clubs',
  'route-schedule',
  'route-calendar',
  'route-events',
  'route-flex',
  'route-pass',
  'route-courses',
  'route-notifications',
  'route-profile',
  'route-admin',
];

function commandValue(action: CommandAction) {
  return [action.label, action.detail, action.badge, ...(action.keywords ?? [])]
    .filter(Boolean)
    .join(' ');
}

export function GlobalCommandPalette({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const shouldLoad = open && !!user;
  const showAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  const { data: announcements = [] } = useRestQuery<any[]>({
    queryKey: ['command-announcements'],
    queryFn: () => announcementsApi.getAll().then((response) => response.data),
    enabled: shouldLoad,
  });
  const clubs = useQuery(api.clubs.management.getAll, shouldLoad ? {} : 'skip') ?? [];
  const myClubs = useQuery(api.clubs.management.getMyClubs, shouldLoad ? {} : 'skip');
  const { data: events = [] } = useRestQuery<any[]>({
    queryKey: ['command-events'],
    queryFn: () => eventsApi.getAll().then((response) => response.data),
    enabled: shouldLoad,
  });
  const courses =
    useQuery(api.courses.catalog.list, shouldLoad ? { limit: 40 } : 'skip') ?? [];
  const notifications = useQuery(
    api.notifications.inbox.list,
    shouldLoad ? { unreadOnly: true, limit: 20 } : 'skip',
  ) ?? [];
  const { data: flexFridays = [] } = useRestQuery<any[]>({
    queryKey: ['command-flex-friday'],
    queryFn: () => flexFridayApi.getAll().then((response) => response.data),
    enabled: shouldLoad,
  });
  const schedule = useQuery(
    api.schedule.dashboard.get,
    shouldLoad && !!user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')
      ? {}
      : 'skip',
  );

  const myClubIds = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    return new Set(entries.map((club) => club._id));
  }, [myClubs]);

  const navActions = useMemo(() => {
    const items = [...staticActions];
    if (showAdmin) {
      items.push({
        id: 'route-admin',
        label: 'Admin Panel',
        detail: 'Users, moderation, audit, and system controls',
        href: '/admin',
        Icon: Shield,
      });
    }
    return items;
  }, [showAdmin]);

  const entityGroups = useMemo(() => {
    const joinedClubs = clubs
      .filter((club) => myClubIds.has(club._id))
      .slice(0, 12)
      .map((club) => ({
        id: `my-club-${club._id}`,
        label: club.name,
        detail: 'Club workspace',
        href: `/clubs/${club._id}`,
        Icon: Puzzle,
        badge: 'Joined',
        keywords: ['my club', 'joined club', club.name, club.description ?? ''],
      }));

    const clubActions: CommandAction[] = clubs
      .filter((club) => !myClubIds.has(club._id))
      .slice(0, 24)
      .map((club) => ({
      id: `club-${club._id}`,
      label: club.name,
      detail: club.description || 'Club workspace',
      href: `/clubs/${club._id}`,
      Icon: Puzzle,
      badge: myClubIds.has(club._id) ? 'Joined' : undefined,
      keywords: ['club', club.name, club.description ?? ''],
    }));

    const unreadAnnouncements = announcements
      .filter((announcement) => !announcement.isRead)
      .slice(0, 8)
      .map((announcement) => ({
        id: `unread-announcement-${announcement.id}`,
        label: announcement.title,
        detail: announcement.club?.name || announcement.targetType?.replace(/_/g, ' ') || 'Announcement',
        href: `/announcements/${announcement.id}`,
        Icon: Megaphone,
        badge: 'Unread',
        keywords: ['unread', 'announcement', announcement.body, announcement.club?.name],
      }));

    const announcementActions: CommandAction[] = announcements.slice(0, 18).map((announcement) => ({
      id: `announcement-${announcement.id}`,
      label: announcement.title,
      detail: announcement.club?.name || announcement.targetType?.replace(/_/g, ' ') || 'Announcement',
      href: `/announcements/${announcement.id}`,
      Icon: Megaphone,
      badge: announcement.isRead ? undefined : 'Unread',
      keywords: ['announcement', announcement.body, announcement.club?.name],
    }));

    const eventActions: CommandAction[] = events.slice(0, 25).map((event) => ({
      id: `event-${event.id}`,
      label: event.title,
      detail: [event.location, event.club?.name].filter(Boolean).join(' · ') || 'Event',
      href: event.id ? `/events/${event.id}` : '/events',
      Icon: Ticket,
      keywords: ['event', event.description, event.location, event.club?.name],
    }));

    const courseActions: CommandAction[] = courses.slice(0, 25).map((course) => ({
      id: `course-${course.slug}`,
      label: course.title,
      detail: [course.department, course.pathway?.replace(/_/g, ' ')].filter(Boolean).join(' · ') || 'Course',
      href: `/courses/${course.slug}`,
      Icon: BookOpen,
      keywords: ['course', course.department, course.courseNumbers?.join(' ')],
    }));

    const notificationActions: CommandAction[] = notifications.slice(0, 15).map((notification) => ({
      id: `notification-${notification.id}`,
      label: notification.title,
      detail: notification.body || notification.category?.replace(/_/g, ' '),
      href: notification.channelId && notification.clubId
        ? `/clubs/${notification.clubId}/channels/${notification.channelId}`
        : notification.announcementId
          ? `/announcements/${notification.announcementId}`
          : notification.eventId
            ? `/events/${notification.eventId}`
            : notification.clubId
              ? `/clubs/${notification.clubId}`
              : '/notifications',
      Icon: Bell,
      badge: 'Unread',
      keywords: ['notification', notification.category, notification.body],
    }));

    const flexActions: CommandAction[] = flexFridays.slice(0, 10).map((friday) => ({
      id: `flex-${friday.id}`,
      label: friday.date ? `Flex Friday ${friday.date.slice(0, 10)}` : 'Flex Friday',
      detail: friday.type?.replace(/_/g, ' ') || 'Workshop day',
      href: `/flex-friday?friday=${friday.id}`,
      Icon: Sparkles,
      keywords: ['flex friday', friday.notes, friday.type],
    }));

    const scheduleActions: CommandAction[] = [
      ...(schedule?.friends ?? []).slice(0, 12).map((friend) => ({
        id: `schedule-friend-${friend.id}`,
        label: `${friend.user.firstName} ${friend.user.lastName}`,
        detail: 'Schedule friend',
        href: '/schedule?tab=friends',
        Icon: Users,
        keywords: ['schedule friend', friend.user.uniqueId],
      })),
    ];

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
    };
  }, [announcements, clubs, courses, events, flexFridays, myClubIds, notifications, schedule]);

  const suggestedActions = useMemo(() => {
    const unreadNotifications = entityGroups.notifications.slice(0, 3);
    const unreadAnnouncements = entityGroups.unreadAnnouncements.slice(0, 3);
    const joinedClubs = entityGroups.joinedClubs.slice(0, 4);
    const primaryPages = navActions.filter((action) =>
      ['route-dashboard', 'route-announcements', 'route-clubs', 'route-schedule'].includes(action.id),
    );
    return [...unreadNotifications, ...unreadAnnouncements, ...joinedClubs, ...primaryPages].slice(0, 10);
  }, [entityGroups, navActions]);

  const run = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search IA: pages, clubs, announcements, events, courses..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Best matches">
          {suggestedActions.map((action) => (
            <CommandItem key={action.id} value={commandValue(action)} onSelect={() => run(action.href)}>
              <action.Icon className="mr-2 size-4" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{action.label}</span>
                  {action.badge ? (
                    <Badge variant="solid" className="h-5 rounded-full px-1.5 text-[10px]">
                      {action.badge}
                    </Badge>
                  ) : null}
                </div>
                {action.detail ? (
                  <p className="truncate text-xs text-muted-foreground">{action.detail}</p>
                ) : null}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Pages">
          {[...navActions]
            .sort((left, right) => pageOrder.indexOf(left.id) - pageOrder.indexOf(right.id))
            .map((action) => (
              <CommandItem key={action.id} value={commandValue(action)} onSelect={() => run(action.href)}>
                <action.Icon className="mr-2 size-4" />
                <span className="truncate">{action.label}</span>
                {action.detail ? <CommandShortcut>{action.detail}</CommandShortcut> : null}
              </CommandItem>
            ))}
        </CommandGroup>

        {Object.entries({
          Notifications: entityGroups.notifications,
          'My Clubs': entityGroups.joinedClubs,
          Announcements: entityGroups.announcements,
          Clubs: entityGroups.clubs,
          Events: entityGroups.events,
          Courses: entityGroups.courses,
          'Flex Friday': entityGroups.flex,
          Schedule: entityGroups.schedule,
        }).map(([heading, actions]) =>
          actions.length > 0 ? (
            <CommandGroup key={heading} heading={heading}>
              {actions.map((action) => (
                <CommandItem key={action.id} value={commandValue(action)} onSelect={() => run(action.href)}>
                  <action.Icon className="mr-2 size-4" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{action.label}</span>
                      {action.badge ? (
                        <Badge variant="solid" className="h-5 rounded-full px-1.5 text-[10px]">
                          {action.badge}
                        </Badge>
                      ) : null}
                    </div>
                    {action.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{action.detail}</p>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}

        <CommandGroup heading="Account">
          <CommandItem value="profile account settings preferences" onSelect={() => run('/profile')}>
            <User className="mr-2 size-4" />
            Profile and settings
          </CommandItem>
          <CommandItem value="search command palette cmd k" onSelect={() => onOpenChange(false)}>
            <Search className="mr-2 size-4" />
            Close search
            <CommandShortcut>Esc</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

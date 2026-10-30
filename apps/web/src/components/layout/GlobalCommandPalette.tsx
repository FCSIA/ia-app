'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useQuery } from '@/lib/convex-react';
import {
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Home,
  Megaphone,
  PanelTop,
  Settings,
  Shield,
  Presentation,
  Ticket,
  UsersRound,
} from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useAnnouncementFeedClock } from '@/components/announcements/use-announcement-feed-clock';
import { hasRole, isSuperAdmin, type AppUser } from '@/lib/auth';
import { useNavigationLoadingOptional } from '@/components/layout/navigation-loading-provider';
import {
  CommandMenu,
  CommandMenuDialogContent,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
  CommandMenuTabs,
  type CommandMenuItemData,
} from '@/components/ui/command-menu';
import {
  useGlobalCommandActions,
  type CommandAction,
} from '@/components/layout/use-global-command-actions';
import { personalCommandQueryArgs, rankCommandSuggestions } from './command-suggestions';
import { schoolDateKey } from '@/lib/school-date';

const staticActions: CommandAction[] = [
  { id: 'route-dashboard', label: 'Dashboard', detail: 'Home and widgets', href: '/dashboard', Icon: Home },
  { id: 'route-announcements', label: 'Announcements', detail: 'Official updates', href: '/announcements', Icon: Megaphone },
  { id: 'route-clubs', label: 'Clubs', detail: 'Directory and workspaces', href: '/clubs', Icon: UsersRound },
  { id: 'route-schedule', label: 'Schedule', detail: 'Classes and friends', href: '/schedule', Icon: ClipboardList },
  { id: 'route-events', label: 'Events', detail: 'School and club events', href: '/events', Icon: Ticket },
  { id: 'route-calendar', label: 'Calendar', detail: 'Shared calendar', href: '/calendar', Icon: CalendarRange },
  { id: 'route-courses', label: 'Courses', detail: 'Course catalog', href: '/courses', Icon: BookOpen },
  { id: 'route-flex', label: 'Flex Friday', detail: 'Workshops and passes', href: '/flex-friday', Icon: Presentation },
  { id: 'route-notifications', label: 'Notifications', detail: 'Inbox and settings', href: '/notifications', Icon: Bell },
  { id: 'route-profile', label: 'Profile Settings', detail: 'Account and preferences', href: '/profile', Icon: Settings },
];

const commandTabs = [
  { value: 'all', label: 'All' },
  { value: 'pages', label: 'Pages' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'people', label: 'People' },
  { value: 'clubs', label: 'Clubs' },
];

function menuItem(action: CommandAction, group: string, run: (href: string) => void): CommandMenuItemData {
  return {
    value: action.id,
    label: action.label,
    action: `Open ${action.label}`,
    description: [action.badge, action.detail].filter(Boolean).join(' · '),
    icon: action.Icon,
    keywords: [...(action.keywords ?? []), ...(action.badge ? [action.badge] : [])],
    group,
    onSelect: () => run(action.href),
  };
}

export function GlobalCommandPalette({
  user,
  open,
}: {
  user: AppUser | null;
  open: boolean;
}) {
  return (
    <CommandMenuDialogContent
      title="Search IA"
      description="Find pages, people, clubs, announcements, events, and courses."
    >
      <GlobalCommandPaletteContent
        key={open ? 'open' : 'closed'}
        user={user}
        open={open}
      />
    </CommandMenuDialogContent>
  );
}

function GlobalCommandPaletteContent({
  user,
  open,
}: {
  user: AppUser | null;
  open: boolean;
}) {
  const router = useRouter();
  const navigationLoading = useNavigationLoadingOptional();
  const { isAuthenticated } = useConvexAuth();
  const [searchValue, setSearchValue] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const deferredSearch = useDeferredValue(searchValue.trim());
  const shouldLoad = open && isAuthenticated && !!user;
  const shouldLoadMemberships = shouldLoad && !isSuperAdmin(user);
  const showAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');
  const announcementNow = useAnnouncementFeedClock();
  const minuteNow = useAnnouncementFeedClock(60_000);
  const [openedAt] = useState(() => Date.now());
  const now = Math.max(openedAt, minuteNow);
  const personalArgs = personalCommandQueryArgs({ open, isAuthenticated, hasUser: !!user, now });

  const announcements = useQuery(api.announcements.feed.list, shouldLoad ? { now: announcementNow } : 'skip');
  const clubs = useQuery(api.clubs.management.getAll, shouldLoad ? {} : 'skip');
  const myClubs = useQuery(
    api.clubs.management.getMyClubs,
    shouldLoadMemberships ? {} : 'skip',
  );
  const events = useQuery(api.events.events.list, shouldLoad ? {} : 'skip');
  const courses = useQuery(api.courses.catalog.list, shouldLoad ? { limit: 40 } : 'skip');
  const notifications = useQuery(
    api.notifications.inbox.list,
    shouldLoad ? { unreadOnly: true, limit: 20 } : 'skip',
  );
  const flexFridays = useQuery(api.flexFriday.fridays.list, shouldLoad ? {} : 'skip');
  const personalWorkshops = useQuery(api.flexFriday.workshops.upcomingPersonal, personalArgs.workshops);
  const calendarEntries = useQuery(api.events.calendar.list, personalArgs.calendar);
  const upcomingEvents = useQuery(api.events.events.upcoming, personalArgs.events);
  const needsYou = useQuery(api.dashboard.needsYou.list, personalArgs.needsYou);
  const schedule = useQuery(
    api.schedule.dashboard.get,
    shouldLoad &&
      !!user &&
      hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')
      ? { dateKey: schoolDateKey(new Date(now)) }
      : 'skip',
  );
  const globalResults = useQuery(
    api.search.global.palette,
    shouldLoad && deferredSearch.length >= 2 ? { search: deferredSearch } : 'skip',
  );

  const myClubIds = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    return new Set<string>(entries.map((club) => club._id));
  }, [myClubs]);

  const entityGroups = useGlobalCommandActions({
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
  });
  const navActions = useMemo(() => {
    const items = [...staticActions];
    if (entityGroups.hasStudentBooking) {
      items.push({ id: 'route-pass', label: 'My Pass', detail: 'Your booked Flex Friday workshops', href: '/flex-friday/pass', Icon: PanelTop });
    }
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
  }, [showAdmin, entityGroups.hasStudentBooking]);
  const run = useCallback((href: string) => {
    navigationLoading?.startNavigation(href);
    router.push(href);
  }, [navigationLoading, router]);

  const allItems = useMemo(() => {
    const groups: Array<[string, CommandAction[]]> = [
      ['Pages', navActions],
      ['Workshops', entityGroups.workshops],
      ['Your calendar', entityGroups.calendar],
      ['Today', entityGroups.todaySchedule],
      ['Needs you', entityGroups.tasks],
      ['Notifications', entityGroups.notifications],
      ['My Clubs', entityGroups.joinedClubs],
      ['Announcements', entityGroups.announcements],
      ['Clubs', entityGroups.clubs],
      ['Events', entityGroups.events],
      ['Courses', entityGroups.courses],
      ['People', entityGroups.people],
      ['Club Channels', entityGroups.channels],
      ['Flex Friday', entityGroups.flex],
      ['Schedule', entityGroups.schedule],
    ];
    return groups.flatMap(([group, actions]) => actions.map((action) => menuItem(action, group, run)));
  }, [entityGroups, navActions, run]);
  const items = useMemo(() => {
    if (selectedTab === 'pages') return allItems.filter((item) => item.group === 'Pages');
    if (selectedTab === 'agenda') return allItems.filter((item) => ['Workshops', 'Your calendar', 'Today', 'Events', 'Flex Friday'].includes(item.group ?? ''));
    if (selectedTab === 'people') return allItems.filter((item) => item.group === 'People' || item.group === 'Schedule');
    if (selectedTab === 'clubs') return allItems.filter((item) => ['My Clubs', 'Clubs', 'Club Channels'].includes(item.group ?? ''));
    return allItems;
  }, [allItems, selectedTab]);
  const suggestions = useMemo(() => rankCommandSuggestions([
    ...entityGroups.workshops, ...entityGroups.calendar, ...entityGroups.todaySchedule,
    ...entityGroups.tasks, ...entityGroups.events, ...entityGroups.notifications, ...entityGroups.announcements,
  ].flatMap((action) => action.suggestion ? [{ ...action.suggestion, id: action.id, href: action.href }] : []), now), [entityGroups, now]);
  const searchingRemote = shouldLoad && searchValue.trim().length >= 2 &&
    (deferredSearch !== searchValue.trim() || globalResults === undefined);
  const waitingForPeopleQuery = selectedTab === 'people' && searchValue.trim().length < 2;

  return (
    <CommandMenu items={items} query={searchValue} onQueryChange={setSearchValue} suggestions={suggestions}>
      <CommandMenuInput placeholder="Search IA…" aria-label="Search IA" />
      <CommandMenuTabs tabs={commandTabs} value={selectedTab} onValueChange={setSelectedTab} />
      <CommandMenuList renderItem={(item) => (
        <CommandMenuItem value={item.value}>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">{item.label}</span>
            {item.description ? <span className="min-w-0 truncate text-muted-foreground">{item.description}</span> : null}
          </span>
        </CommandMenuItem>
      )}>
        <CommandMenuEmpty>
          {searchingRemote && selectedTab !== 'pages'
            ? 'Searching people and club channels…'
            : waitingForPeopleQuery
              ? 'Type at least two characters to find people.'
              : 'No results found. Try another name or keyword.'}
        </CommandMenuEmpty>
      </CommandMenuList>
      <CommandMenuFooter />
    </CommandMenu>
  );
}

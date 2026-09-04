'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@/lib/convex-react';
import {
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Home,
  Megaphone,
  PanelTop,
  Search,
  Settings,
  Shield,
  Presentation,
  Ticket,
  User,
  UsersRound,
} from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { hasRole, isSuperAdmin, type AppUser } from '@/lib/auth';
import { useNavigationLoadingOptional } from '@/components/layout/navigation-loading-provider';
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
import {
  useGlobalCommandActions,
  type CommandAction,
} from '@/components/layout/use-global-command-actions';

const staticActions: CommandAction[] = [
  { id: 'route-dashboard', label: 'Dashboard', detail: 'Home and widgets', href: '/dashboard', Icon: Home },
  { id: 'route-announcements', label: 'Announcements', detail: 'Official updates', href: '/announcements', Icon: Megaphone },
  { id: 'route-clubs', label: 'Clubs', detail: 'Directory and workspaces', href: '/clubs', Icon: UsersRound },
  { id: 'route-schedule', label: 'Schedule', detail: 'Classes and friends', href: '/schedule', Icon: ClipboardList },
  { id: 'route-events', label: 'Events', detail: 'School and club events', href: '/events', Icon: Ticket },
  { id: 'route-calendar', label: 'Calendar', detail: 'Shared calendar', href: '/calendar', Icon: CalendarRange },
  { id: 'route-courses', label: 'Courses', detail: 'Course catalog', href: '/courses', Icon: BookOpen },
  { id: 'route-flex', label: 'Flex Friday', detail: 'Workshops and passes', href: '/flex-friday', Icon: Presentation },
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

function ActionRow({ action, onSelect }: { action: CommandAction; onSelect: () => void }) {
  return (
    <CommandItem value={commandValue(action)} onSelect={onSelect}>
      <action.Icon />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate font-medium">{action.label}</span>
        {action.badge ? (
          <Badge variant="solid" className="h-5 shrink-0 rounded-full px-1.5 text-[10px]">
            {action.badge}
          </Badge>
        ) : null}
        {action.detail ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{action.detail}</span>
        ) : null}
      </div>
    </CommandItem>
  );
}

function ActionGroups({
  groups,
  run,
}: {
  groups: Array<[string, CommandAction[]]>;
  run: (href: string) => void;
}) {
  return groups.map(([heading, actions]) =>
    actions.length > 0 ? (
      <CommandGroup key={heading} heading={heading}>
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} onSelect={() => run(action.href)} />
        ))}
      </CommandGroup>
    ) : null,
  );
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
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <GlobalCommandPaletteContent
        key={open ? 'open' : 'closed'}
        user={user}
        open={open}
        onOpenChange={onOpenChange}
      />
    </CommandDialog>
  );
}

function GlobalCommandPaletteContent({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const navigationLoading = useNavigationLoadingOptional();
  const [searchValue, setSearchValue] = useState('');
  const hasSearch = searchValue.trim().length > 0;
  const deferredSearch = useDeferredValue(searchValue.trim());
  const shouldLoad = open && !!user;
  const shouldLoadMemberships = shouldLoad && !isSuperAdmin(user);
  const showAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  const announcements = useQuery(api.announcements.feed.list, shouldLoad ? {} : 'skip');
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
  const schedule = useQuery(
    api.schedule.dashboard.get,
    shouldLoad &&
      !!user &&
      hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')
      ? {}
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

  const entityGroups = useGlobalCommandActions({
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
  });
  const suggestedActions = useMemo(() => {
    const primaryPages = navActions.filter((action) =>
      ['route-dashboard', 'route-announcements', 'route-clubs', 'route-schedule'].includes(action.id),
    );
    return [
      ...entityGroups.notifications.slice(0, 3),
      ...entityGroups.unreadAnnouncements.slice(0, 3),
      ...entityGroups.joinedClubs.slice(0, 4),
      ...primaryPages,
    ].slice(0, 10);
  }, [entityGroups, navActions]);
  const groups: Array<[string, CommandAction[]]> = [
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

  const run = (href: string) => {
    onOpenChange(false);
    navigationLoading?.startNavigation(href);
    router.push(href);
  };

  return (
    <>
      <CommandInput
        value={searchValue}
        onValueChange={setSearchValue}
        placeholder="Search IA: people, club channels, pages, events..."
      />
      <CommandList className="w-full min-w-0">
        {hasSearch ? (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Best matches">
              {suggestedActions.map((action) => (
                <ActionRow key={action.id} action={action} onSelect={() => run(action.href)} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        <CommandGroup heading="Pages">
          {[...navActions]
            .sort((left, right) => pageOrder.indexOf(left.id) - pageOrder.indexOf(right.id))
            .map((action) => (
              <CommandItem
                key={action.id}
                value={commandValue(action)}
                onSelect={() => run(action.href)}
              >
                <action.Icon />
                <span className="min-w-0 truncate">{action.label}</span>
                {action.detail ? <CommandShortcut>{action.detail}</CommandShortcut> : null}
              </CommandItem>
            ))}
        </CommandGroup>
        {hasSearch ? <ActionGroups groups={groups} run={run} /> : null}
        <CommandGroup heading="Account">
          <CommandItem value="profile account settings preferences" onSelect={() => run('/profile')}>
            <User />
            <span className="min-w-0 truncate">Profile and settings</span>
          </CommandItem>
          <CommandItem value="search command palette cmd k" onSelect={() => onOpenChange(false)}>
            <Search />
            <span className="min-w-0 truncate">Close search</span>
            <CommandShortcut>Esc</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

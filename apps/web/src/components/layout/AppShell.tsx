'use client';

import { useEffect, useMemo, useState, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Home,
  LogOut,
  MessageSquareWarning,
  Megaphone,
  Menu,
  UsersRound,
  Settings,
  Shield,
  Sparkles,
  Star,
  Ticket,
  Search,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from 'convex/react';

import { clearAuth, hasRole, useCurrentUser } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';
import { api } from '~/apps/convex/src/_generated/api';
import { computeWrappedAvailability } from '@/lib/wrapped';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dropdown, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { Tooltip } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { GlobalCommandPalette } from '@/components/layout/GlobalCommandPalette';
import { useNavigationLoadingOptional } from '@/components/layout/navigation-loading-provider';
import { PageTransition } from '@/components/layout/page-transition';
import { UserAvatar } from '@/components/ui/user-avatar';

type NavItem = { href: string; label: string; icon: LucideIcon };

export type ChannelSearchControl = {
  channelName: string;
  value: string;
  onValueChange: (value: string) => void;
};

const primaryNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/clubs', label: 'Clubs', icon: UsersRound },
  { href: '/schedule', label: 'Schedule', icon: ClipboardList },
  { href: '/events', label: 'Events', icon: Ticket },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/flex-friday', label: 'Flex Friday', icon: Sparkles },
  { href: '/wrapped', label: 'Wrapped', icon: Star },
];

const accountNav: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/report', label: 'Report a concern', icon: MessageSquareWarning },
  { href: '/profile', label: 'Profile & Settings', icon: Settings },
];

const adminNav: NavItem[] = [{ href: '/admin', label: 'Admin Panel', icon: Shield }];

function NavIcon({
  item,
  active,
  badge,
  onHover,
}: {
  item: NavItem;
  active: boolean;
  badge?: ReactNode;
  onHover?: () => void;
}) {
  const { icon: Icon, label, href } = item;
  return (
    <Tooltip side="right" sideOffset={10} content={label}>
      <Link
        href={href}
        prefetch={true}
        onMouseEnter={onHover}
        aria-label={label}
        className={cn(
          'group relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[#6B97FF]',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <Icon className="size-5 transition-[stroke-width] duration-100 group-hover:stroke-[2.25]" strokeWidth={active ? 2.25 : 1.75} />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 z-20 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}

export function AppShell({
  children,
  headerSlot,
  mainClassName,
  pageTransitionClassName,
  channelSearch,
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  mainClassName?: string;
  pageTransitionClassName?: string;
  channelSearch?: ChannelSearchControl;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandHint, setCommandHint] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<'everything' | 'channel'>('everything');
  const { toast } = useToast();
  const navigationLoading = useNavigationLoadingOptional();
  const safePathname = pathname ?? '/dashboard';

  useEffect(() => {
    setCommandHint(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    const onOpenGlobalSearch = () => setCommandOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('ia:open-global-search', onOpenGlobalSearch);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('ia:open-global-search', onOpenGlobalSearch);
    };
  }, []);

  // Close mobile sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [safePathname]);

  const unreadData = useQuery(api.notifications.inbox.unreadCount);

  const handlePrefetch = (href: string) => {
    switch (href) {
      case '/announcements':
        break;
      case '/clubs':
        break;
      case '/events':
        break;
      case '/schedule':
        break;
      case '/flex-friday':
        break;
      case '/notifications':
        break;
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch { }
    clearAuth();
    router.replace('/login');
    toast({ title: 'Logged out' });
  };

  const isActive = (href: string) =>
    safePathname === href || (href !== '/dashboard' && safePathname.startsWith(href));

  const showAdmin = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');
  const showSchedule =
    user && hasRole(user, 'STUDENT', 'ADMIN', 'SUPER_ADMIN');
  // Wrapped only appears in the nav during its May window — hidden for
  // everyone (including admins) outside that window. Admins who need to
  // preview can still navigate to /wrapped directly.
  const showWrapped = computeWrappedAvailability().open;

  const primary = useMemo(
    () =>
      primaryNav.filter((i) => {
        if (i.href === '/schedule' && !showSchedule) return false;
        if (i.href === '/wrapped' && !showWrapped) return false;
        return true;
      }),
    [showSchedule, showWrapped],
  );

  const unreadBadge = unreadData?.count
    ? unreadData.count > 9
      ? '9+'
      : String(unreadData.count)
    : undefined;

  return (
    <Fragment>
      <div className="app-root flex min-h-screen w-full bg-background">
        {/* Narrow dark sidebar (icon-only, sticky).
            z-40 creates a stacking context above all sibling content (including
            the clubs workspace secondary sidebar at bg-background / z-auto), so
            the hover label that extends to the right of the 72px column floats
            on top of everything instead of being clipped behind the next pane. */}
        <aside
          className="sticky top-0 z-40 hidden h-screen w-[72px] shrink-0 flex-col items-center bg-sidebar py-6 text-sidebar-foreground md:flex"
          aria-label="Primary navigation"
        >
          <Link
            href="/dashboard"
            aria-label="Home"
            className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.png" alt="Innovation Academy phoenix" className="size-full object-cover" />
          </Link>

          <div className="mt-4 flex min-h-0 flex-1 flex-col items-center gap-1.5 px-0">
            {primary.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(item.href)}
                badge={item.href === '/notifications' ? unreadBadge : undefined}
                onHover={() => handlePrefetch(item.href)}
              />
            ))}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-3">
            {accountNav.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(item.href)}
                badge={item.href === '/notifications' ? unreadBadge : undefined}
                onHover={() => handlePrefetch(item.href)}
              />
            ))}
            {showAdmin
              ? adminNav.map((item) => (
                <NavIcon key={item.href} item={item} active={isActive(item.href)} onHover={() => handlePrefetch(item.href)} />
              ))
              : null}
          </div>
        </aside>

        {/* Mobile nav (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-r bg-sidebar p-0 text-sidebar-foreground">
            <VisuallyHidden>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden>
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
                <Link
                  href="/dashboard"
                  aria-label="Home"
                  className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/logo.png" alt="Innovation Academy phoenix" className="size-full object-cover" />
                </Link>
              </div>
              <ScrollArea
                className="min-h-0 flex-1 text-sidebar-foreground"
              >
                <nav className="flex flex-col gap-1 p-3">
                  {primary.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      badge={item.href === '/notifications' ? unreadBadge : undefined}
                      onHover={() => handlePrefetch(item.href)}
                    />
                  ))}
                  <div className="my-2 h-px bg-sidebar-border" />
                  {accountNav.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={item}
                      active={isActive(item.href)}
                      badge={item.href === '/notifications' ? unreadBadge : undefined}
                      onHover={() => handlePrefetch(item.href)}
                    />
                  ))}
                  {showAdmin
                    ? adminNav.map((item) => (
                        <MobileNavLink key={item.href} item={item} active={isActive(item.href)} onHover={() => handlePrefetch(item.href)} />
                      ))
                    : null}
                </nav>
              </ScrollArea>
              <div className="flex items-center justify-between border-t border-sidebar-border p-3" />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="app-main-surface flex min-w-0 flex-1 flex-col bg-card">
          <header className="app-main-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {headerSlot ?? <div className="min-w-0 flex-1" />}
            </div>
            <div className="hidden h-9 w-80 items-center rounded-full bg-surface-2 px-1.5 text-sm text-muted-foreground shadow-surface-1 focus-within:ring-1 focus-within:ring-[#6B97FF] lg:flex">
              {channelSearch && searchScope === 'channel' ? (
                <label className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
                  <Search className="size-4 shrink-0" />
                  <span className="sr-only">Search #{channelSearch.channelName}</span>
                  <input
                    value={channelSearch.value}
                    onChange={(event) => channelSearch.onValueChange(event.target.value)}
                    placeholder={`Search #${channelSearch.channelName}`}
                    className="h-8 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
              ) : (
                <button
                  type="button"
                  className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full px-1.5 text-left outline-none transition-colors hover:text-foreground"
                  onClick={() => setCommandOpen(true)}
                >
                  <Search className="size-4 shrink-0" />
                  <span className="flex-1">Search everything</span>
                  <KbdGroup>
                    {commandHint ? <Kbd>⌘</Kbd> : <Kbd>Ctrl</Kbd>}
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </button>
              )}
              {channelSearch ? (
                <>
                  <span className="mx-1 h-4 w-px shrink-0 bg-border/70" aria-hidden />
                  <Tooltip
                    content={searchScope === 'everything' ? `Search #${channelSearch.channelName}` : 'Search everything'}
                  >
                    <button
                      type="button"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={searchScope === 'everything' ? `Search #${channelSearch.channelName}` : 'Search everything'}
                      onClick={() => {
                        channelSearch.onValueChange('');
                        setSearchScope((current) => current === 'everything' ? 'channel' : 'everything');
                      }}
                    >
                      <ArrowLeftRight className="size-3.5" />
                    </button>
                  </Tooltip>
                </>
              ) : null}
            </div>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-full bg-surface-2 py-1.5 pl-1.5 pr-3 shadow-surface-1 transition-colors hover:bg-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]"
                  >
                    <UserAvatar
                      firstName={user.firstName}
                      lastName={user.lastName}
                      avatarUrl={user.avatarUrl}
                      className="size-8"
                      fallbackClassName="text-xs"
                    />
                    <div className="hidden min-w-0 leading-tight sm:block">
                      <p className="truncate text-left text-sm font-medium text-foreground">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-1">
                  <Dropdown className="w-60">
                    <DropdownLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>
                    </DropdownLabel>
                    <DropdownSeparator />
                    <MenuItem
                      icon={Settings}
                      label="Settings"
                      index={0}
                      onSelect={() => {
                        navigationLoading?.startNavigation('/profile');
                        router.push('/profile');
                      }}
                    />
                    <DropdownSeparator />
                    <MenuItem
                      icon={LogOut}
                      label="Sign out"
                      index={1}
                      onSelect={handleLogout}
                      className="text-red-500 [&_svg]:text-red-500"
                    />
                  </Dropdown>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </header>

          <main className={mainClassName ?? 'flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8'}>
            <PageTransition className={pageTransitionClassName}>
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
      <GlobalCommandPalette user={user} open={commandOpen} onOpenChange={setCommandOpen} />
    </Fragment>
  );
}

function MobileNavLink({
  item,
  active,
  badge,
  onHover,
}: {
  item: NavItem;
  active: boolean;
  badge?: ReactNode;
  onHover?: () => void;
}) {
  const { icon: Icon, label, href } = item;
  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={onHover}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

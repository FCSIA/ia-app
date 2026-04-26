'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Home,
  LogOut,
  Megaphone,
  Menu,
  Puzzle,
  Settings,
  Shield,
  Sparkles,
  Star,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { AppUser } from '@ia/contracts/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '../ThemeToggle';
import { clearAuth, getUser, hasRole } from '@/lib/auth';
import { authApi, notificationsApi, announcementsApi, clubsApi, eventsApi, scheduleApi, flexFridayApi } from '@/lib/api';
import { computeWrappedAvailability } from '@/lib/wrapped';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

type NavItem = { href: string; label: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/clubs', label: 'Clubs', icon: Puzzle },
  { href: '/schedule', label: 'Schedule', icon: ClipboardList },
  { href: '/events', label: 'Events', icon: Ticket },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/flex-friday', label: 'Flex Friday', icon: Sparkles },
  { href: '/wrapped', label: 'Wrapped', icon: Star },
];

const accountNav: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile & Settings', icon: Settings },
];

const adminNav: NavItem[] = [{ href: '/admin', label: 'Admin Panel', icon: Shield }];

const pageMeta: Record<string, { label: string; detail: string }> = {
  '/dashboard': { label: 'Dashboard', detail: 'Signals, priorities, and fast paths.' },
  '/announcements': { label: 'Announcements', detail: 'Official voice, updates, and follow-up.' },
  '/clubs': { label: 'Clubs', detail: 'Team spaces, channels, and sponsor oversight.' },
  '/courses': { label: 'Courses', detail: 'Catalog, prerequisites, and class details.' },
  '/schedule': { label: 'Schedule', detail: 'View and manage your daily periods.' },
  '/events': { label: 'Events', detail: 'What is next and what needs attention.' },
  '/calendar': { label: 'Calendar', detail: 'Shared planning across the week.' },
  '/flex-friday': { label: 'Flex Friday', detail: 'Sign-ups and sections for Friday.' },
  '/wrapped': { label: 'Wrapped', detail: 'Your year at a glance.' },
  '/notifications': { label: 'Notifications', detail: 'Unread mentions and direct follow-up.' },
  '/profile': { label: 'Profile', detail: 'Identity, preferences, account settings.' },
  '/admin': { label: 'Admin', detail: 'Controls, permissions, operational views.' },
};

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
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={onHover}
      aria-label={label}
      className="group relative flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          'pointer-events-none absolute left-0 top-0 z-10 flex h-11 items-center rounded-full transition-[background-color,box-shadow] duration-150',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/60 group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground',
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
        </span>
        <span className="hidden whitespace-nowrap pr-5 text-sm font-medium group-hover:inline">
          {label}
        </span>
      </span>
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 z-20 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground group-hover:hidden">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

const sortedPageMeta = Object.entries(pageMeta).sort(([a], [b]) => b.length - a.length);

export function AppShell({
  children,
  headerSlot,
  mainClassName,
}: {
  children: ReactNode;
  headerSlot?: ReactNode;
  mainClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const safePathname = pathname ?? '/dashboard';

  useEffect(() => {
    setUser(getUser());
  }, []);

  // Close mobile sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [safePathname]);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((response) => response.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const handlePrefetch = (href: string) => {
    switch (href) {
      case '/announcements':
        queryClient.prefetchQuery({ queryKey: ['announcements'], queryFn: () => announcementsApi.getAll().then((r) => r.data) });
        break;
      case '/clubs':
        queryClient.prefetchQuery({ queryKey: ['my-clubs'], queryFn: () => clubsApi.getMyClubs().then((r) => r.data) });
        queryClient.prefetchQuery({ queryKey: ['clubs'], queryFn: () => clubsApi.getAll().then((r) => r.data) });
        break;
      case '/events':
        queryClient.prefetchQuery({ queryKey: ['events'], queryFn: () => eventsApi.getAll().then((r) => r.data) });
        break;
      case '/schedule':
        queryClient.prefetchQuery({ queryKey: ['schedule-dashboard'], queryFn: () => scheduleApi.getDashboard().then((r) => r.data) });
        break;
      case '/flex-friday':
        queryClient.prefetchQuery({ queryKey: ['flex-friday'], queryFn: () => flexFridayApi.getAll().then((r) => r.data) });
        break;
      case '/notifications':
        queryClient.prefetchQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.getAll().then((r) => r.data) });
        break;
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch { }
    clearAuth();
    queryClient.clear();
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

  const currentMeta = useMemo(
    () =>
      sortedPageMeta.find(
        ([href]) => safePathname === href || (href !== '/dashboard' && safePathname.startsWith(href)),
      )?.[1] ?? pageMeta['/dashboard'],
    [safePathname],
  );

  const unreadBadge = unreadData?.count
    ? unreadData.count > 9
      ? '9+'
      : String(unreadData.count)
    : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background">
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
            <img src="/icons/logo.png" alt="IA" className="size-full object-cover" />
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
            <div className="my-2 h-px w-8 bg-white/10" />
            <ThemeToggle />
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
                  <img src="/icons/logo.png" alt="IA" className="size-full object-cover" />
                </Link>
                <span className="text-sm font-semibold text-sidebar-foreground">IA</span>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {primary.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    badge={item.href === '/notifications' ? unreadBadge : undefined}
                    onHover={() => handlePrefetch(item.href)}
                  />
                ))}
                <div className="my-3 h-px bg-sidebar-border" />
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
              <div className="flex items-center justify-between border-t border-sidebar-border p-3">
                <span className="text-xs text-sidebar-foreground/60">Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6 lg:px-8">
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
              {headerSlot ?? (
                <div className="flex min-w-0 flex-1 flex-col leading-none">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {currentMeta.label}
                  </h1>
                </div>
              )}
            </div>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-full border bg-muted/40 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span className="text-xs font-semibold">
                        {user.firstName.charAt(0)}
                        {user.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="hidden min-w-0 leading-tight sm:block">
                      <p className="truncate text-left text-sm font-medium text-foreground">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-left text-[11px] text-muted-foreground">
                        {user.uniqueId}
                      </p>
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.uniqueId}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <Settings className="mr-2 size-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-600"
                  >
                    <LogOut className="mr-2 size-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </header>

          <main className={mainClassName ?? 'flex-1 px-4 pb-8 pt-6 md:px-6 md:pt-8 lg:px-8'}>{children}</main>
        </div>
      </div>
    </TooltipProvider>
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

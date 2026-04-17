'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  CalendarRange,
  Home,
  LogOut,
  Megaphone,
  Puzzle,
  School,
  Settings,
  Shield,
  Sparkles,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { AppUser } from '@ia/contracts/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemeToggle } from '../ThemeToggle';
import { clearAuth, getUser, hasRole } from '@/lib/auth';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/clubs', label: 'Clubs', icon: Puzzle },
  { href: '/schedule', label: 'School Day', icon: School },
  { href: '/events', label: 'Events', icon: Ticket },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/flex-friday', label: 'Flex Friday', icon: Sparkles },
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
  '/schedule': { label: 'School Day', detail: 'View and manage your daily periods.' },
  '/events': { label: 'Events', detail: 'What is next and what needs attention.' },
  '/calendar': { label: 'Calendar', detail: 'Shared planning across the week.' },
  '/flex-friday': { label: 'Flex Friday', detail: 'Sign-ups and sections for Friday.' },
  '/notifications': { label: 'Notifications', detail: 'Unread mentions and direct follow-up.' },
  '/profile': { label: 'Profile', detail: 'Identity, preferences, account settings.' },
  '/admin': { label: 'Admin', detail: 'Controls, permissions, operational views.' },
};

function NavIcon({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: ReactNode;
}) {
  const { icon: Icon, label, href } = item;
  return (
    <Link
      href={href}
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const safePathname = pathname ?? '/dashboard';

  useEffect(() => {
    setUser(getUser());
  }, []);

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((response) => response.data),
    refetchInterval: 30_000,
  });

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

  const primary = primaryNav.filter((i) => i.href !== '/schedule' || showSchedule);

  const currentMeta =
    Object.entries(pageMeta)
      .sort(([a], [b]) => b.length - a.length)
      .find(([href]) => safePathname === href || (href !== '/dashboard' && safePathname.startsWith(href)))?.[1]
    ?? pageMeta['/dashboard'];

  const unreadBadge = unreadData?.count
    ? unreadData.count > 9
      ? '9+'
      : String(unreadData.count)
    : undefined;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background">
        {/* Narrow dark sidebar (icon-only, sticky) */}
        <aside
          className="sticky top-0 hidden h-screen w-[72px] shrink-0 flex-col items-center bg-sidebar py-6 text-sidebar-foreground md:flex"
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
              />
            ))}
            {showAdmin
              ? adminNav.map((item) => (
                <NavIcon key={item.href} item={item} active={isActive(item.href)} />
              ))
              : null}
            <div className="my-2 h-px w-8 bg-white/10" />
            <ThemeToggle />
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b bg-card/95 px-6 backdrop-blur lg:px-8">
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

          <main className={mainClassName ?? 'flex-1 px-6 pb-8 lg:px-8'}>{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

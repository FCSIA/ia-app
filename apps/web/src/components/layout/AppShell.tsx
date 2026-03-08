'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  BookOpen,
  Calendar,
  CalendarRange,
  Clock3,
  Home,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AppUser } from '@ia/contracts/auth';
import { useQuery } from '@tanstack/react-query';
import { ThemeToggle } from '../ThemeToggle';
import { clearAuth, getUser, hasRole } from '@/lib/auth';
import { authApi, notificationsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/clubs', label: 'Clubs', icon: BookOpen },
  { href: '/schedule', label: 'Schedule', icon: Clock3 },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/calendar', label: 'Calendar', icon: CalendarRange },
  { href: '/flex-friday', label: 'Flex Friday', icon: Zap },
];

const utilityNavItems = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile & Settings', icon: Settings },
];

const adminNavItems = [{ href: '/admin', label: 'Admin Panel', icon: Shield }];

const pageMeta = [
  { href: '/dashboard', label: 'Dashboard', detail: 'Signals, priorities, and fast paths.' },
  { href: '/announcements', label: 'Announcements', detail: 'Official voice, updates, and follow-up.' },
  { href: '/clubs', label: 'Clubs', detail: 'Team spaces, channels, and sponsor oversight.' },
  { href: '/schedule', label: 'Schedule', detail: 'Live blocks, friend schedules, and week structure.' },
  { href: '/events', label: 'Events', detail: 'What is next, what needs attention, what is live.' },
  { href: '/calendar', label: 'Calendar', detail: 'Shared planning across the school week.' },
  { href: '/flex-friday', label: 'Flex Friday', detail: 'Sign-ups, sections, and movement for Friday.' },
  { href: '/notifications', label: 'Notifications', detail: 'Unread mentions, updates, and direct follow-up.' },
  { href: '/profile', label: 'Profile', detail: 'Identity, preferences, and account settings.' },
  { href: '/admin', label: 'Admin', detail: 'Controls, permissions, and operational views.' },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size="lg"
        tooltip={label}
        isActive={active}
        className={cn(
          'h-11 rounded-2xl px-3 text-[0.95rem] font-medium',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20 hover:bg-sidebar-primary'
            : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <Link href={href}>
          <Icon className={cn(active ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/55')} />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const { toast } = useToast();
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
    } catch {}
    clearAuth();
    router.replace('/login');
    toast({ title: 'Logged out' });
  };

  const isActive = (href: string) =>
    safePathname === href || (href !== '/dashboard' && safePathname.startsWith(href));

  const showAdmin = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');
  const showSchedule =
    user && hasRole(user, 'STUDENT', 'STUDENT_LEADER', 'STUDENT_ADMIN', 'ADMIN', 'SUPER_ADMIN');

  const navGroups = [
    {
      label: 'Explore',
      items: navItems.filter((item) => item.href !== '/schedule' || showSchedule),
    },
    { label: 'Account', items: utilityNavItems },
    ...(showAdmin ? [{ label: 'Admin', items: adminNavItems }] : []),
  ];

  const currentMeta =
    [...pageMeta]
      .sort((left, right) => right.href.length - left.href.length)
      .find(
        (entry) =>
          safePathname === entry.href ||
          (entry.href !== '/dashboard' && safePathname.startsWith(entry.href)),
      ) ?? pageMeta[0];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="inset" collapsible="icon" className="border-none bg-transparent">
        <SidebarHeader className="p-3">
          <div className="surface-rail overflow-hidden">
            <div className="border-b border-sidebar-border/70 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/25">
                  <Sparkles className="size-5" />
                </div>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/55">
                    IA School
                  </p>
                  <p className="truncate text-base font-semibold text-sidebar-foreground">
                    Student Operating System
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-[1.4rem] border border-sidebar-border/70 bg-sidebar-primary/10 p-3 group-data-[collapsible=icon]:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-primary/80">
                  Daily focus
                </p>
                <p className="mt-2 text-sm leading-6 text-sidebar-foreground/78">
                  Clubs, schedules, and school signals should feel like one product, not five stitched panels.
                </p>
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 pb-3">
          <div className="surface-rail flex h-full flex-col overflow-hidden">
            {navGroups.map((group, index) => (
              <div key={group.label}>
                {index > 0 ? <SidebarSeparator className="mx-4 my-1 bg-sidebar-border/70" /> : null}
                <SidebarGroup className="px-3 py-3">
                  <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/45">
                    {group.label}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.href}
                          {...item}
                          active={isActive(item.href)}
                          badge={
                            item.href === '/notifications' && unreadData?.count
                              ? unreadData.count > 9
                                ? '9+'
                                : unreadData.count
                              : undefined
                          }
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>
            ))}
          </div>
        </SidebarContent>

        <SidebarFooter className="p-3 pt-0">
          <div className="surface-rail space-y-3 p-3">
            <div className="flex items-center justify-between rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/70 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/45">
                  Theme
                </p>
                <p className="truncate text-sm text-sidebar-foreground/75">Orange-tinted glass</p>
              </div>
              <ThemeToggle />
            </div>

            {user ? (
              <div className="rounded-[1.4rem] border border-sidebar-border/70 bg-sidebar-accent/60 p-3">
                <div className="group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-sidebar-foreground/45">{user.uniqueId}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.roles?.slice(0, 2).map((role: string) => (
                      <Badge key={role} variant="secondary" className="rounded-full border border-sidebar-border/70 bg-sidebar text-[10px]">
                        {role.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="hidden items-center justify-center group-data-[collapsible=icon]:flex">
                  <span className="flex size-9 items-center justify-center rounded-2xl bg-sidebar-primary/15 text-xs font-semibold text-sidebar-primary">
                    {user.firstName.charAt(0)}
                    {user.lastName.charAt(0)}
                  </span>
                </div>
              </div>
            ) : null}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="h-10 justify-start rounded-2xl text-red-500 hover:bg-red-500/10 hover:text-red-600 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6 lg:px-8">
          <div className="surface-panel flex items-center justify-between gap-4 px-4 py-3 backdrop-blur-xl sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="rounded-2xl border border-border/70 bg-background/80 hover:bg-muted/60" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                  {currentMeta.label}
                </p>
                <p className="truncate text-sm text-foreground/68">{currentMeta.detail}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 md:flex">
                <Badge
                  variant="secondary"
                  className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] font-medium"
                >
                  <CalendarRange className="mr-1 size-3.5" />
                  School day mode
                </Badge>
                {user?.uniqueId ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] font-medium"
                  >
                    {user.uniqueId}
                  </Badge>
                ) : null}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden page-enter">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

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
        tooltip={label}
        isActive={active}
      >
        <Link href={href}>
          <Icon />
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
    } catch { }
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
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold text-sidebar-foreground">IA School</span>
                    <span className="text-xs text-sidebar-foreground/70">Student OS</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group, index) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
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
          ))}
        </SidebarContent>

        <SidebarFooter>
          {user ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary/10 text-sidebar-primary">
                    <span className="text-xs font-medium">
                      {user.firstName.charAt(0)}
                      {user.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="hidden min-w-0 flex-1 group-data-[collapsible=icon]:block">
                    <p className="truncate text-sm font-medium">{user.firstName} {user.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.uniqueId}</p>
                  </div>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : null}
          <div className="px-2 py-2">
            <ThemeToggle />
          </div>
          <div className="px-2 pb-2">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-500 hover:bg-red-500/10 hover:text-red-600"
            >
              <LogOut className="mr-2 size-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 pr-6 backdrop-blur">
          <SidebarTrigger />
          <div className="flex min-w-0 items-center gap-2 border-l pl-3 text-sm">
            <p className="font-semibold text-foreground">
              {currentMeta.label}
            </p>
            <p className="truncate text-muted-foreground hidden sm:block">• {currentMeta.detail}</p>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

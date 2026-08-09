import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarRange,
  ClipboardList,
  Home,
  MessageSquareText,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  Star,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

type NavItem = { href: string; label: string; icon: LucideIcon };

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/clubs", label: "Clubs", icon: UsersRound },
  { href: "/schedule", label: "Schedule", icon: ClipboardList },
  { href: "/events", label: "Events", icon: Ticket },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/flex-friday", label: "Flex Friday", icon: Sparkles },
  { href: "/wrapped", label: "Wrapped", icon: Star },
];

const accountNav: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/report", label: "Share feedback", icon: MessageSquareText },
  { href: "/profile", label: "Profile & Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
];

type AppShellNavigationProps = {
  pathname: string;
  unreadBadge?: string;
  showAdmin: boolean;
  showSchedule: boolean;
  showWrapped: boolean;
};

function getNavigationItems({
  showSchedule,
  showWrapped,
}: AppShellNavigationProps) {
  return primaryNav.filter((item) => {
    if (item.href === "/schedule" && !showSchedule) return false;
    if (item.href === "/wrapped" && !showWrapped) return false;
    return true;
  });
}

function isActive(pathname: string, href: string) {
  return (
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  );
}

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
    <Tooltip side="right" sideOffset={10} content={label}>
      <Link
        href={href}
        prefetch={true}
        aria-label={label}
        className={cn(
          "group relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon
          className="size-5 transition-[stroke-width] duration-100 group-hover:stroke-[2.25]"
          strokeWidth={active ? 2.25 : 1.75}
        />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 z-20 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </Link>
    </Tooltip>
  );
}

function MobileNavLink({
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
      prefetch={true}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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

function AppShellDesktopNavigation(props: AppShellNavigationProps) {
  const primary = getNavigationItems(props);

  return (
    <aside
      className="sticky top-0 z-40 hidden h-screen w-[72px] shrink-0 flex-col items-center bg-sidebar py-6 text-sidebar-foreground md:flex"
      aria-label="Primary navigation"
    >
      <AppLogo className="size-11" />

      <div className="mt-4 flex min-h-0 flex-1 flex-col items-center gap-1.5 px-0">
        {primary.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isActive(props.pathname, item.href)}
            badge={
              item.href === "/notifications" ? props.unreadBadge : undefined
            }
          />
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5 pt-3">
        {accountNav.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isActive(props.pathname, item.href)}
            badge={
              item.href === "/notifications" ? props.unreadBadge : undefined
            }
          />
        ))}
        {props.showAdmin
          ? adminNav.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(props.pathname, item.href)}
              />
            ))
          : null}
      </div>
    </aside>
  );
}

function AppShellMobileNavigation({
  open,
  onOpenChange,
  ...props
}: AppShellNavigationProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const primary = getNavigationItems(props);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 border-r bg-sidebar p-0 text-sidebar-foreground"
      >
        <VisuallyHidden>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            Navigate to another area of the app.
          </SheetDescription>
        </VisuallyHidden>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
            <AppLogo className="size-10" />
          </div>
          <ScrollArea className="min-h-0 flex-1 text-sidebar-foreground">
            <nav className="flex flex-col gap-1 p-3">
              {primary.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  active={isActive(props.pathname, item.href)}
                  badge={
                    item.href === "/notifications"
                      ? props.unreadBadge
                      : undefined
                  }
                />
              ))}
              <div className="my-2 h-px bg-sidebar-border" />
              {accountNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  active={isActive(props.pathname, item.href)}
                  badge={
                    item.href === "/notifications"
                      ? props.unreadBadge
                      : undefined
                  }
                />
              ))}
              {props.showAdmin
                ? adminNav.map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={item}
                      active={isActive(props.pathname, item.href)}
                    />
                  ))
                : null}
            </nav>
          </ScrollArea>
          <div className="flex items-center justify-between border-t border-sidebar-border p-3" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AppLogo({ className }: { className: string }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Home"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/logo.png"
        alt="Innovation Academy phoenix"
        className="size-full object-cover"
      />
    </Link>
  );
}

export { AppShellDesktopNavigation, AppShellMobileNavigation };

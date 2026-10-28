"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
  type Ref,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CalendarRange,
  ClipboardList,
  Ellipsis,
  Home,
  MessageSquareText,
  Menu,
  Megaphone,
  Settings,
  Shield,
  Presentation,
  Star,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import { IaOrbitMark } from "@/components/ui/ia-orbit-mark";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMobileTabMemory } from "@/components/layout/use-mobile-tab-memory";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { useNavIntent, usePrewarmRoute } from "@/lib/route-prewarm";
import {
  DropdownContent,
  DropdownLabel,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";

export type MobileTabId =
  | "announcements"
  | "clubs"
  | "schedule"
  | "calendar"
  | "events"
  | "flex-friday"
  | "wrapped";

export const MOBILE_TAB_DESTINATION_MIN = 4;
export const MOBILE_TAB_DESTINATION_MAX = 5;

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobileTabId?: MobileTabId;
};

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/announcements", label: "Announcements", icon: Megaphone, mobileTabId: "announcements" },
  { href: "/clubs", label: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_FRIDAY_PROTOTYPE === 'true' ? "Community" : "Clubs", icon: UsersRound, mobileTabId: "clubs" },
  { href: "/schedule", label: "Schedule", icon: ClipboardList, mobileTabId: "schedule" },
  { href: "/events", label: "Events", icon: Ticket, mobileTabId: "events" },
  { href: "/calendar", label: "Calendar", icon: CalendarRange, mobileTabId: "calendar" },
  { href: "/flex-friday", label: "Flex Friday", icon: Presentation, mobileTabId: "flex-friday" },
  { href: "/wrapped", label: "Wrapped", icon: Star, mobileTabId: "wrapped" },
];

const accountNav: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/report", label: "Feedback", icon: MessageSquareText },
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
  mobileTabLayout?: string[];
};

const NAV_ICON_SIZE = 44;
const NAV_ICON_GAP = 6;
const COMPACT_RAIL_HEIGHT = 208;
const NORMAL_RAIL_FIXED_HEIGHT = 156;
const COMPACT_RAIL_FIXED_HEIGHT = 68;
const PINNED_AUXILIARY_FIXED_HEIGHT = 332;

/**
 * Returns the number of overflow-eligible destinations that can remain in the
 * desktop rail. Browser zoom changes the rail's CSS-pixel height, so this
 * intentionally measures available height instead of relying on viewport
 * breakpoint guesses. A rail tall enough to pin auxiliary controls reserves
 * their full height before allocating primary destinations.
 */
export function getDesktopNavigationCapacity({
  railHeight,
  itemCount,
  reserveAuxiliaryControls = false,
}: {
  railHeight: number;
  itemCount: number;
  reserveAuxiliaryControls?: boolean;
}) {
  if (!Number.isFinite(railHeight) || railHeight <= 0 || itemCount <= 0) {
    return 0;
  }

  const fixedHeight = reserveAuxiliaryControls
    ? PINNED_AUXILIARY_FIXED_HEIGHT
    : railHeight <= COMPACT_RAIL_HEIGHT
      ? COMPACT_RAIL_FIXED_HEIGHT
      : NORMAL_RAIL_FIXED_HEIGHT;
  const slotHeight = NAV_ICON_SIZE + NAV_ICON_GAP;
  const capacity = Math.floor(
    (railHeight - fixedHeight + NAV_ICON_GAP) / slotHeight,
  );

  return Math.max(0, Math.min(itemCount, capacity));
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function useDesktopNavigationRailHeight(
  railRef: RefObject<HTMLElement | null>,
) {
  const [railHeight, setRailHeight] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const syncCapacity = () => {
      setRailHeight(desktopQuery.matches ? rail.clientHeight : null);
    };

    syncCapacity();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncCapacity);
    resizeObserver?.observe(rail);
    desktopQuery.addEventListener("change", syncCapacity);
    window.addEventListener("resize", syncCapacity);

    return () => {
      resizeObserver?.disconnect();
      desktopQuery.removeEventListener("change", syncCapacity);
      window.removeEventListener("resize", syncCapacity);
    };
  }, [railRef]);

  return railHeight;
}

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
  const intent = useNavIntent(href);

  return (
    <Tooltip side="right" sideOffset={10} content={label}>
      <Link
        href={href}
        prefetch={true}
        {...intent}
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
  const intent = useNavIntent(href);

  return (
    <Link
      href={href}
      prefetch={true}
      {...intent}
      className={cn(
        "flex min-h-12 touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-[background-color,color,transform] active:scale-[0.985]",
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
  const router = useRouter();
  const railRef = useRef<HTMLElement>(null);
  const railHeight = useDesktopNavigationRailHeight(railRef);
  const profile = accountNav.find((item) => item.href === "/profile")!;
  const auxiliaryItems = [
    ...accountNav.filter((item) => item.href !== profile.href),
    ...(props.showAdmin ? adminNav : []),
  ];
  const pinAuxiliaryControls =
    railHeight !== null && railHeight >= PINNED_AUXILIARY_FIXED_HEIGHT;
  const overflowCandidates = pinAuxiliaryControls
    ? primary
    : [...primary, ...auxiliaryItems];
  const capacity = railHeight === null
    ? overflowCandidates.length
    : getDesktopNavigationCapacity({
        railHeight,
        itemCount: overflowCandidates.length,
        reserveAuxiliaryControls: pinAuxiliaryControls,
      });
  const hasOverflow = capacity < overflowCandidates.length;
  // The ellipsis occupies one of the available control slots when anything
  // moves into it, so reserve that slot before choosing direct destinations.
  const directItems = hasOverflow
    ? overflowCandidates.slice(0, Math.max(0, capacity - 1))
    : overflowCandidates;
  const overflowItems = overflowCandidates.slice(directItems.length);
  const overflowActive = overflowItems.some((item) =>
    isActive(props.pathname, item.href),
  );

  return (
    <aside
      ref={railRef}
      className="sticky top-0 z-40 hidden h-[100dvh] w-[72px] shrink-0 flex-col items-center overflow-hidden bg-sidebar py-3 text-sidebar-foreground lg:flex [@media(max-height:13rem)]:py-2"
      aria-label="Primary navigation"
    >
      <AppLogo className="size-11 [@media(max-height:13rem)]:hidden" />

      <nav
        className="mt-3 flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-hidden px-0 [@media(max-height:13rem)]:mt-0"
        aria-label="Primary navigation destinations"
      >
        {directItems.map((item) => (
          <NavIcon
            key={item.href}
            item={item}
            active={isActive(props.pathname, item.href)}
            badge={
              item.href === "/notifications" ? props.unreadBadge : undefined
            }
          />
        ))}
      </nav>

      <div className="flex shrink-0 flex-col items-center gap-1.5 pt-2">
        {hasOverflow ? (
          <DesktopNavigationOverflow
            items={overflowItems}
            active={overflowActive}
            pathname={props.pathname}
            unreadBadge={props.unreadBadge}
            onNavigate={(href) => router.push(href)}
          />
        ) : null}
        {pinAuxiliaryControls
          ? auxiliaryItems.map((item) => (
              <NavIcon
                key={item.href}
                item={item}
                active={isActive(props.pathname, item.href)}
                badge={item.href === "/notifications" ? props.unreadBadge : undefined}
              />
            ))
          : null}
        <NavIcon item={profile} active={isActive(props.pathname, profile.href)} />
      </div>
    </aside>
  );
}

function DesktopNavigationOverflow({
  items,
  active,
  pathname,
  unreadBadge,
  onNavigate,
}: {
  items: NavItem[];
  active: boolean;
  pathname: string;
  unreadBadge?: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip side="right" sideOffset={10} content="More navigation">
        <DropdownTrigger
          render={
            <button
              type="button"
              aria-label="Open more navigation"
              className={cn(
                "group relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[#6B97FF]",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Ellipsis
                className="size-5 transition-[stroke-width] duration-100 group-hover:stroke-[2.25]"
                strokeWidth={active ? 2.25 : 1.75}
              />
              {unreadBadge && items.some((item) => item.href === "/notifications") ? (
                <span className="absolute -right-0.5 -top-0.5 z-20 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {unreadBadge}
                </span>
              ) : null}
            </button>
          }
        />
      </Tooltip>
      <DropdownContent side="right" align="end" className="w-56">
        <DropdownLabel>More navigation</DropdownLabel>
        {items.map((item, index) => (
          <MenuItem
            key={item.href}
            index={index}
            icon={item.icon}
            label={item.label}
            onSelect={() => onNavigate(item.href)}
            className={cn(
              isActive(pathname, item.href) && "bg-active",
            )}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
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
  const directPaths = new Set(
    getMobileTabItems(props)
      .filter((item) => item.href !== "#more")
      .map((item) => item.href),
  );
  const overflowPrimary = primary.filter((item) => !directPaths.has(item.href));

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
    >
      <DrawerContent
        className="max-h-[min(82dvh,42rem)] border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        <DrawerHeader className="border-b border-sidebar-border px-4 pb-3 pt-1 text-left">
          <DrawerTitle className="text-base text-sidebar-foreground">
            More
          </DrawerTitle>
          <DrawerDescription className="text-xs text-sidebar-foreground/65">
            Events, feedback, account tools, and additional app areas.
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="min-h-0 flex-1 text-sidebar-foreground">
          <nav className="flex flex-col gap-1 p-3 pb-2">
              {overflowPrimary.map((item) => (
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
              {overflowPrimary.length ? (
                <div className="my-2 h-px bg-sidebar-border" />
              ) : null}
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
      </DrawerContent>
    </Drawer>
  );
}

type MobileTabItem = NavItem | { href: "#more"; label: "More"; icon: typeof Menu };

function getMobileTabEditorItems(props: AppShellNavigationProps) {
  return getNavigationItems(props).filter(
    (item): item is NavItem & { mobileTabId: MobileTabId } => item.mobileTabId !== undefined,
  );
}

function getMobileTabItems(props: AppShellNavigationProps): MobileTabItem[] {
  const availableItems = getMobileTabEditorItems(props);
  const availableById = new Map(availableItems.map((item) => [item.mobileTabId, item]));
  const defaults: MobileTabId[] = [
    "announcements",
    "clubs",
    props.showSchedule ? "schedule" : "calendar",
    "events",
  ];
  const savedIds = (props.mobileTabLayout ?? []).filter(
    (id): id is MobileTabId => availableById.has(id as MobileTabId),
  );
  const selectedIds = [
    ...savedIds,
    ...defaults,
  ].filter(
    (id, index, ids) => availableById.has(id) && ids.indexOf(id) === index,
  ).slice(0, MOBILE_TAB_DESTINATION_MAX);

  return [
    { href: "/dashboard", label: "Home", icon: Home },
    ...selectedIds.map((id) => {
      const item = availableById.get(id)!;
      return item.href === "/announcements" ? { ...item, label: "Feed" } : item;
    }),
    { href: "#more", label: "More", icon: Menu },
  ];
}

function AppShellMobileTabBar({
  onOpenMenu,
  tabBarRef,
  ...props
}: AppShellNavigationProps & {
  onOpenMenu: () => void;
  tabBarRef?: Ref<HTMLElement>;
}) {
  const reduceMotion = useReducedMotion();
  const { getHref } = useMobileTabMemory();
  const prewarm = usePrewarmRoute();
  const items = getMobileTabItems(props);
  const directItems = items.filter((item) => item.href !== "#more");
  const moreActive = !directItems.some((item) => isActive(props.pathname, item.href));

  return (
    <nav
      ref={tabBarRef}
      aria-label="Primary mobile navigation"
      className={cn("app-mobile-tabbar fixed inset-x-0 bottom-0 z-40 grid border-t border-border/70 bg-card px-1 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden", CARD_SURFACE_FOREGROUND)}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        transform: 'translateY(var(--app-mobile-tabbar-viewport-offset, 0px))',
      }}
    >
      {items.map((item) => {
        const active = item.href === "#more" ? moreActive : isActive(props.pathname, item.href);
        const Icon = item.icon;
        const content = (
          <>
            {active ? (
              <motion.span
                layoutId="app-mobile-tab-active"
                aria-hidden
                className="absolute inset-x-1 inset-y-1 rounded-2xl bg-active"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.2, bounce: 0 }}
              />
            ) : null}
            <Icon
              aria-hidden
              className={cn(
                "relative size-[22px] transition-[stroke-width,transform] duration-150",
                active && "scale-105",
              )}
              strokeWidth={active ? 2.25 : 1.75}
            />
            {item.href === "#more" && props.unreadBadge ? (
              <span className="absolute right-[18%] top-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {props.unreadBadge}
              </span>
            ) : null}
          </>
        );

        const className = cn(
          "relative flex min-h-12 touch-manipulation items-center justify-center overflow-hidden rounded-2xl px-1 text-muted-foreground outline-none transition-[color,transform] active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-ring",
          active && "text-foreground",
        );

        if (item.href === "#more") {
          return (
            <button
              key={item.href}
              type="button"
              className={className}
              aria-label="Open more navigation"
              title="More"
              aria-current={active ? "page" : undefined}
              onClick={onOpenMenu}
            >
              {content}
            </button>
          );
        }
        const tabId = (item as { mobileTabId?: MobileTabId }).mobileTabId;
        const href = getHref(tabId, item.href);
        return (
          <Link
            key={item.href}
            href={href}
            prefetch
            onPointerEnter={() => prewarm(href)}
            onFocus={() => prewarm(href)}
            className={className}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
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
      <IaOrbitMark
        alt="IA Orbit"
        width={64}
        height={64}
        className="size-full object-cover"
      />
    </Link>
  );
}

export {
  AppShellDesktopNavigation,
  AppShellMobileNavigation,
  AppShellMobileTabBar,
  getMobileTabEditorItems,
};

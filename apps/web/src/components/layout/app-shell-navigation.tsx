"use client";

import {
  useState,
  type ReactNode,
  type Ref,
} from "react";
import Link from "next/link";
import { CalendarDays, Home, Menu, LayoutTemplate, School, Search } from "lucide-react";

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
import { useNavIntent, usePrewarmRoute } from "@/lib/route-prewarm";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { CommandMenuDialogTrigger } from "@/components/ui/command-menu";

import { MobileTabEditor } from "./mobile-tab-editor";
import { normalizeSidebarLayout } from "~/apps/shared/sidebar-layout";
import { Button } from "@/components/ui/button";
import { normalizeMobileTabLayout } from "./mobile-tab-layout";
import { routePath, type MobileTabId } from "@/lib/routes";
import {
  primaryNav, socialNav, accountNav, adminNav,
  getNavigationItems, getSocialItems, getMobileTabEditorItems, getSidebarEditorItems,
  type NavItem, type AppPageNavigation, type AppShellNavigationProps,
} from "./app-navigation-options";
export type { AppPageNavigation } from "./app-navigation-options";

const dayPlanNav: Array<NavItem> = [
  { href: "/schedule?tab=admin&section=dates", label: "Calendar dates", icon: CalendarDays },
  { href: "/schedule?tab=admin&section=templates", label: "Templates", icon: LayoutTemplate },
  { href: "/schedule?tab=admin&section=config", label: "School config", icon: School },
];

function isActive(pathname: string, href: string, activeHref?: string) {
  const [target, query] = href.split("?");
  if (query) return activeHref === href;
  if (activeHref && activeHref !== href && activeHref.split("?")[0] === target) return false;
  return pathname === target || (target !== "/" && pathname.startsWith(`${target}/`));
}

function MobileNavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: Pick<NavItem, "href" | "label"> & Partial<Pick<NavItem, "icon">>;
  active: boolean;
  badge?: ReactNode;
  onNavigate?: () => void;
}) {
  const { icon: Icon, label, href } = item;
  const intent = useNavIntent(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      prefetch={true}
      {...intent}
      className={cn(
        "flex min-h-12 touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-[background-color,color,transform] active:scale-[0.985]",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {Icon ? <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} /> : null}
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function DesktopNavLink({ item, active, badge, subNavigation }: {
  item: NavItem;
  active: boolean;
  badge?: string;
  subNavigation?: AppPageNavigation["items"];
}) {
  const intent = useNavIntent(item.href);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} prefetch {...intent} aria-label={badge ? `${item.label}, ${badge} unread` : item.label} />}
        icon={item.icon}
        isActive={active && !subNavigation?.some((child) => child.isActive)}
      >
        {item.label}
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge aria-hidden>{badge}</SidebarMenuBadge> : null}
      {subNavigation ? (
        <SidebarMenuSub>
          {subNavigation.map((child) => (
            <DesktopSubNavigationLink key={child.href} item={child} />
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

function DesktopSubNavigationLink({ item }: { item: AppPageNavigation["items"][number] }) {
  const intent = useNavIntent(item.href);
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<Link href={item.href} prefetch {...intent} />}
        icon={item.icon}
        isActive={item.isActive}
      >
        {item.label}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function getPageNavigation(props: AppShellNavigationProps): AppPageNavigation[] {
  return [
    ...(props.showDayPlans && props.pageNavigation?.parentHref !== "/schedule" ? [{
      parentHref: "/schedule",
      label: "Day plans",
      items: dayPlanNav.map(({ href, label }) => ({ href, label, isActive: false })),
    }] : []),
    ...(props.pageNavigation ? [props.pageNavigation] : []),
  ];
}

function AppShellDesktopNavigation(props: AppShellNavigationProps & {
  commandHint: boolean;
}) {
  const primary = getNavigationItems(props).filter((item) => !socialNav.some((social) => social.href === item.href));
  const social = getSocialItems(props);
  const pageNavigation = getPageNavigation(props);
  const getSubNavigation = (href: string) => pageNavigation.find((group) => group.parentHref === href)?.items;
  const profile = accountNav.find((item) => item.href === routePath("profile"))!;
  const account = [
    ...accountNav.filter((item) => item.href !== profile.href),
    ...(props.showAdmin ? adminNav : []),
  ];
  const available = getSidebarEditorItems(props);
  const selected = normalizeSidebarLayout(props.sidebarLayout, available.map((item) => item.href));
  const customized = props.sidebarLayout !== undefined;
  const availableByHref = new Map(available.map((item) => [item.href, item]));
  const selectedHrefs = new Set(selected);
  const ordered = selected.map((href) => availableByHref.get(href)!);
  const more = available.filter((item) => !selectedHrefs.has(item.href));
  const renderItem = (item: NavItem) => (
    <DesktopNavLink key={item.href} item={item}
      active={isActive(props.pathname, item.href, props.activeHref)}
      badge={item.href === "/notifications" ? props.unreadBadge : undefined}
      subNavigation={getSubNavigation(item.href)} />
  );

  return (
    <Sidebar variant="inset" role="navigation" aria-label="Primary navigation" className="z-40">
      <SidebarHeader>
        <Link href="/" aria-label="IA App home" className="flex min-h-8 min-w-0 items-center gap-2 px-2">
          <IaOrbitMark alt="" width={16} height={16} className="size-4 shrink-0" />
          <span className="truncate text-sm font-semibold">IA App</span>
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <CommandMenuDialogTrigger asChild>
              <SidebarMenuButton icon={Search}>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>Search</span>
                  <KbdGroup aria-hidden>
                    <Kbd>{props.commandHint ? "⌘" : "Ctrl"}</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </span>
              </SidebarMenuButton>
            </CommandMenuDialogTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {customized ? <>
          <SidebarGroup>
            <SidebarMenu>
              {renderItem(primaryNav[0])}
              {ordered.map(renderItem)}
            </SidebarMenu>
          </SidebarGroup>
          {more.length ? <SidebarGroup collapsible defaultOpen={false}>
            <SidebarGroupLabel>More</SidebarGroupLabel>
            <SidebarMenu>{more.map(renderItem)}</SidebarMenu>
          </SidebarGroup> : null}
        </> : <>
        <SidebarGroup>
          <SidebarMenu>
            {primary.map((item) => (
              <DesktopNavLink key={item.href} item={item} active={isActive(props.pathname, item.href, props.activeHref)} subNavigation={getSubNavigation(item.href)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup collapsible>
          <SidebarGroupLabel>Social</SidebarGroupLabel>
          <SidebarMenu>
            {social.map((item) => (
              <DesktopNavLink key={item.href} item={item} active={isActive(props.pathname, item.href, props.activeHref)} subNavigation={getSubNavigation(item.href)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup collapsible>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
            {account.map((item) => (
              <DesktopNavLink
                key={item.href}
                item={item}
                active={isActive(props.pathname, item.href, props.activeHref)}
                badge={item.href === "/notifications" ? props.unreadBadge : undefined}
                subNavigation={getSubNavigation(item.href)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        </>}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <DesktopNavLink item={profile} active={isActive(props.pathname, profile.href, props.activeHref)} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
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
  const [editorOpen, setEditorOpen] = useState(false);
  const primary = getNavigationItems(props);
  const directPaths = new Set(
    getMobileTabItems(props)
      .filter((item) => item.href !== "#more")
      .map((item) => item.href),
  );
  const overflowPrimary = primary.filter((item) => !directPaths.has(item.href) && !socialNav.some((social) => social.href === item.href));
  const overflowSocial = getSocialItems(props).filter((item) => !directPaths.has(item.href));

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[min(82dvh,42rem)] border-sidebar-border bg-sidebar text-sidebar-foreground">
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
                  onNavigate={() => onOpenChange(false)}
                  active={isActive(props.pathname, item.href, props.activeHref)}
                  badge={
                    item.href === "/notifications"
                      ? props.unreadBadge
                      : undefined
                  }
                />
              ))}
              {getPageNavigation(props).map((group) => (
                <section key={group.parentHref} aria-label={group.label}>
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground">{group.label}</p>
                  {group.items.map((item) => (
                    <MobileNavLink key={item.href} item={item} active={item.isActive} onNavigate={() => onOpenChange(false)} />
                  ))}
                </section>
              ))}
              {overflowSocial.length ? (
                <section aria-label="Social">
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground">Social</p>
                  {overflowSocial.map((item) => (
                    <MobileNavLink key={item.href} item={item} active={isActive(props.pathname, item.href, props.activeHref)} onNavigate={() => onOpenChange(false)} />
                  ))}
                </section>
              ) : null}
              {overflowPrimary.length || overflowSocial.length ? (
                <div className="my-2 h-px bg-sidebar-border" />
              ) : null}
              {accountNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  item={item}
                  onNavigate={() => onOpenChange(false)}
                  active={isActive(props.pathname, item.href, props.activeHref)}
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
                      onNavigate={() => onOpenChange(false)}
                      active={isActive(props.pathname, item.href, props.activeHref)}
                    />
                  ))
                : null}
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  onOpenChange(false);
                  setEditorOpen(true);
                }}
              >
                Edit tab bar
              </Button>
            </nav>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
      <MobileTabEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        options={getMobileTabEditorItems(props)}
        savedLayout={props.mobileTabLayout}
        showSchedule={props.showSchedule}
      />
    </>
  );
}

type MobileTabItem =
  NavItem | { href: "#more"; label: "More"; icon: typeof Menu };

function getMobileTabItems(props: AppShellNavigationProps): MobileTabItem[] {
  const availableItems = getMobileTabEditorItems(props);
  const availableById = new Map(
    availableItems.map((item) => [item.mobileTabId, item]),
  );
  const selectedIds = normalizeMobileTabLayout(
    props.mobileTabLayout,
    availableItems.map((item) => item.mobileTabId),
    props.showSchedule,
  );

  return [
    { href: routePath("home"), label: "Home", icon: Home },
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
  const { getHref } = useMobileTabMemory();
  const prewarm = usePrewarmRoute();
  const items = getMobileTabItems(props);
  const directItems = items.filter((item) => item.href !== "#more");
  const moreActive = !directItems.some((item) =>
    isActive(props.pathname, item.href, props.activeHref),
  );

  return (
    <nav
      ref={tabBarRef}
      aria-label="Primary mobile navigation"
      className={cn(
        "app-mobile-tabbar fixed inset-x-0 bottom-0 z-40 grid border-t border-border/70 bg-card pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden",
        CARD_SURFACE_FOREGROUND,
      )}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        transform: "translateY(var(--app-mobile-tabbar-viewport-offset, 0px))",
      }}
    >
      {items.map((item) => {
        const active =
          item.href === "#more"
            ? moreActive
            : isActive(props.pathname, item.href, props.activeHref);
        const Icon = item.icon;
        const content = (
          <>
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-1 inset-y-1 rounded-2xl bg-active"
              />
            ) : null}
            <Icon
              aria-hidden
              className={cn(
                "relative size-[22px]",
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


export {
  AppShellDesktopNavigation,
  AppShellMobileNavigation,
  AppShellMobileTabBar,
};

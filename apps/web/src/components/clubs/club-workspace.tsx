"use client";

import { isSuperAdmin } from "~/apps/shared/roles";
import { CLUBS_HREF, clubChannelHref, clubChannelSettingsHref, clubHref, clubNavigationHref, clubPeopleHref, clubSettingsHref, clubVolunteeringHref, matchClubChannelPath } from "~/apps/shared/routes";
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  ChevronRight,
  ChevronsUpDown,
  Compass,
  ArrowLeft,
  Home,
  HeartHandshake,
  BellOff,
  Menu,
  Plus,
  Settings,
  Trash2,
  Users2,
} from "lucide-react";
import { ClubChannelVisibilityIcon } from "@/components/clubs/channel-visibility";
import { useClubEntryHref } from "@/components/clubs/use-club-entry-href";
import { AppShell } from "@/components/layout/AppShell";
import type { ChannelSearchControl } from "@/components/layout/AppShell";
import { FLUSH_MAIN_CLASS } from "@/components/layout/app-main";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Card, CardGroup } from "@/components/ui/card";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  WorkspaceSidebar,
  WorkspaceSidebarItem,
  WorkspaceSidebarSection,
} from "@/components/ui/workspace-sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MenuItem } from "@/components/ui/menu-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChannelDialog } from "@/components/clubs/dialogs/channel-dialog";
import { useClubId } from "@/app/clubs/club-route";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/lib/auth";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import { DisclosureTitle } from "@/components/ui/pressable";
import {
  formatMuteRemaining,
  useMutedChannels,
} from "@/components/notifications/channel-notification-settings";
import { ancestorIds } from "@/lib/club-units";
import { cn } from "@/lib/utils";
import type {
  ClubNavigationChannel,
  ClubNavigationSummary,
  ClubWorkspaceNavigation,
} from "@/components/clubs/types";

function ClubPickerItem({
  club,
  active,
  index,
}: {
  club: ClubNavigationSummary;
  active: boolean;
  index: number;
}) {
  const router = useRouter();
  const clubEntryHref = useClubEntryHref();
  const ClubLogoIcon = ({ className }: { className?: string }) => (
    <span
      className={cn(
        "flex size-7 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-[11px] font-semibold text-primary",
        className,
      )}
    >
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={club.logoUrl ?? undefined}
          alt=""
          className="size-full bg-background object-cover"
        />
      ) : (
        club.name.charAt(0).toUpperCase()
      )}
    </span>
  );

  return (
    <MenuItem
      index={index}
      label={club.name}
      checked={active}
      onSelect={() => router.push(clubEntryHref(club._id))}
      className="h-11 px-2.5"
      icon={ClubLogoIcon}
    />
  );
}

function ClubIdentity({
  club,
  showPickerIndicator = false,
}: {
  club?: ClubWorkspaceNavigation["club"];
  showPickerIndicator?: boolean;
}) {
  if (!club)
    return (
      <>
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-28" />
      </>
    );
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-[11px] font-bold text-primary">
        {club?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.logoUrl ?? undefined}
            alt=""
            className="size-full bg-background object-cover"
          />
        ) : (
          (club?.name?.charAt(0).toUpperCase() ?? "C")
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {club?.name ?? "Loading…"}
      </span>
      {showPickerIndicator ? (
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );
}

type ClubWorkspaceProps = {
  children: ReactNode;
  navigationOnly?: boolean;
  rightPane?: ReactNode;
  resizableRightPane?: boolean;
  mobileRightPane?: {
    title: string;
    onClose: () => void;
  };
  title?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
  scrollOwner?: "workspace" | "content";
  channelSearch?: ChannelSearchControl;
};

export function ClubWorkspace({
  children,
  navigationOnly = false,
  rightPane,
  resizableRightPane = false,
  mobileRightPane,
  title,
  actions,
  contentClassName,
  scrollOwner = "workspace",
  channelSearch,
}: ClubWorkspaceProps) {
  const pathname = usePathname() ?? "";
  const clubId = useClubId();
  const user = useCurrentUser();
  const [isResizablePaneViewport, setIsResizablePaneViewport] = useState(false);
  const [isResizableNavigationViewport, setIsResizableNavigationViewport] =
    useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileNavigationReveal = useMotionValue(0);
  const navigationAnimationId = useRef(0);
  const reduceMotion = useReducedMotion();
  const mobileNavigationRef = useRef<HTMLElement>(null);
  // Phones stack two layers inside the app root: the club's channel list (and
  // the app tab bar) underneath, the current page on top. Revealing slides the
  // page layer right by `--club-nav-reveal` of its width (globals.css), so the
  // list and tab bar are uncovered rather than drawn over the composer. Written
  // to the DOM directly so a drag doesn't re-render the workspace every frame.
  const [appRoot, setAppRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".app-root");
    setAppRoot(root);
    return () => {
      root?.removeAttribute("data-club-nav-revealed");
      root?.style.removeProperty("--club-nav-reveal");
    };
  }, []);
  useMotionValueEvent(mobileNavigationReveal, "change", (reveal) => {
    if (!appRoot) return;
    appRoot.style.setProperty("--club-nav-reveal", String(reveal));
    appRoot.toggleAttribute("data-club-nav-revealed", reveal > 0);
  });

  const settleMobileNavigation = useCallback((open: boolean) => {
    const animationId = ++navigationAnimationId.current;
    mobileNavigationReveal.stop();
    if (open) setMobileNavigationOpen(true);
    if (reduceMotion) {
      mobileNavigationReveal.set(open ? 1 : 0);
      if (!open) setMobileNavigationOpen(false);
      return;
    }
    // vaul's curve, so pages and sheets move as one family.
    void animate(mobileNavigationReveal, open ? 1 : 0, {
      duration: 0.32,
      ease: [0.32, 0.72, 0, 1],
    }).then(() => {
      if (!open && animationId === navigationAnimationId.current) {
        setMobileNavigationOpen(false);
      }
    });
  }, [mobileNavigationReveal, reduceMotion]);

  const openMobileNavigation = useCallback(
    () => settleMobileNavigation(true),
    [settleMobileNavigation],
  );
  const cancelMobileNavigation = useCallback(
    () => settleMobileNavigation(false),
    [settleMobileNavigation],
  );
  const updateMobileNavigation = useCallback((progress: number) => {
    navigationAnimationId.current += 1;
    mobileNavigationReveal.stop();
    mobileNavigationReveal.set(progress);
  }, [mobileNavigationReveal]);

  useCloseSwipe(mobileNavigationRef, appRoot, {
    onProgress: updateMobileNavigation,
    onSettle: settleMobileNavigation,
  });

  useEffect(() => {
    if (!resizableRightPane) return;

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncViewport = () => setIsResizablePaneViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, [resizableRightPane]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncViewport = () =>
      setIsResizableNavigationViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  });
  const activity = useQuery(api.clubs.detail.getWorkspaceActivity, {
    clubId,
  });
  const { toast } = useToast();
  const deleteChannel = useMutation(api.clubs.channels.remove);
  const club = navigation?.club;
  const activityByChannelId = useMemo(
    () =>
      new Map(
        activity?.channels.map((channel) => [
          channel.channelId,
          channel.hasUnreadMessages,
        ]) ?? [],
      ),
    [activity],
  );
  const channels = useMemo<ClubNavigationChannel[]>(
    () =>
      (navigation?.channels ?? []).map((channel) => ({
        ...channel,
        hasUnreadMessages: activityByChannelId.get(channel._id) ?? false,
      })),
    [activityByChannelId, navigation?.channels],
  );
  const myClubs = navigation?.myClubs ?? [];
  const canCreateChannels = navigation?.viewer.canCreateChannels ?? false;
  const canEditChannels = navigation?.viewer.canEditChannels ?? false;
  const canDeleteChannels = navigation?.viewer.canDeleteChannels ?? false;
  const showClubPicker = !isSuperAdmin(user);

  const activeChannelId = matchClubChannelPath(pathname)?.channelId;
  const clubRootPath = clubHref(clubId);
  const navigationPath = clubNavigationHref(clubId);
  const isNavigationPage = pathname === navigationPath;

  const nav: Array<{
    href: string;
    label: string;
    icon: typeof Home;
    match: (p: string) => boolean;
  }> = [
    {
      href: clubRootPath,
      label: "Overview",
      icon: Home,
      match: (p) => p === clubRootPath,
    },
    {
      href: clubPeopleHref(clubId),
      label: "People",
      icon: Users2,
      match: (p) => p.startsWith(clubPeopleHref(clubId)),
    },
    ...(navigation?.club.volunteerTrackingEnabled && (navigation.viewer.isMember || navigation.viewer.canReviewVolunteerHours) ? [{
      href: clubVolunteeringHref(clubId),
      label: "Volunteering",
      icon: HeartHandshake,
      match: (p: string) => p.startsWith(clubVolunteeringHref(clubId)),
    }] : []),
    ...(navigation?.viewer.canManageRoles ||
    navigation?.viewer.canManageClubStructure ||
    navigation?.viewer.canManageClubSettings
      ? [
          {
            href: clubSettingsHref(clubId),
            label: "Settings",
            icon: Settings,
            match: (p: string) => p.startsWith(clubSettingsHref(clubId)),
          },
        ]
      : []),
  ];

  const headerSlot = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          asChild
          type="button"
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label="Back to clubs"
        >
          <Link href={CLUBS_HREF}>
            <ArrowLeft />
          </Link>
        </Button>
        {isNavigationPage ? (
          <Button
            asChild
            type="button"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Back to clubs"
          >
            <Link href={CLUBS_HREF}>
              <ArrowLeft />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label={
              mobileNavigationOpen
                ? "Close club navigation"
                : "Open club navigation"
            }
            aria-expanded={mobileNavigationOpen}
            onClick={() => settleMobileNavigation(!mobileNavigationOpen)}
          >
            <Menu />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          {title ?? (
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {club?.name ?? <Skeleton className="h-5 w-28" />}
            </h1>
          )}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );

  const desktopNavigation = (
    <ClubNavigationPanel
      density="desktop"
      bordered={!isResizableNavigationViewport}
      clubId={clubId}
      viewerId={user?._id ?? null}
      club={club}
      myClubs={myClubs}
      showClubPicker={showClubPicker}
      nav={nav}
      pathname={pathname}
      channels={channels}
      units={navigation?.units ?? []}
      activeChannelId={activeChannelId}
      canCreateChannels={canCreateChannels}
      canEditChannels={canEditChannels}
      canDeleteChannels={canDeleteChannels}
      onDeleteChannel={(channel) => {
        if (confirm(`Delete #${channel.name}?`)) {
          void deleteChannel({ channelId: channel._id }).then(() =>
            toast({ title: "Channel deleted" }),
          );
        }
      }}
    />
  );

  const workspaceContent = (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      {rightPane && resizableRightPane && isResizablePaneViewport ? (
        <ResizablePanelGroup
          id="club-channel-thread-layout"
          orientation="horizontal"
          defaultLayout={{
            "club-channel-main-panel": 68,
            "club-channel-thread-panel": 32,
          }}
          className="min-w-0"
        >
          <ResizablePanel
            id="club-channel-main-panel"
            defaultSize="68%"
            minSize="55%"
            style={{ overflow: "hidden" }}
          >
            {scrollOwner === "content" ? (
              <div
                className={cn(
                  "h-full min-h-0 min-w-0 overflow-hidden",
                  contentClassName,
                )}
              >
                {children}
              </div>
            ) : (
              <ScrollArea
                className="h-full min-h-0 min-w-0"
                viewportClassName={contentClassName}
              >
                {children}
              </ScrollArea>
            )}
          </ResizablePanel>
          <ResizableHandle id="club-channel-thread-handle" withHandle />
          <ResizablePanel
            id="club-channel-thread-panel"
            defaultSize="32%"
            minSize="18rem"
            maxSize="45%"
            style={{ overflow: "hidden" }}
          >
            <aside className="h-full min-h-0 overflow-hidden bg-surface-1 channel-thread-surface">
              {rightPane}
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          {scrollOwner === "content" ? (
            <div
              className={cn(
                "min-h-0 min-w-0 flex-1 overflow-hidden",
                contentClassName,
              )}
            >
              {children}
            </div>
          ) : (
            <ScrollArea
              className="min-h-0 min-w-0 flex-1"
              viewportClassName={contentClassName}
            >
              {children}
            </ScrollArea>
          )}
          {rightPane ? (
            <aside
              className={cn(
                "hidden w-80 shrink-0 overflow-hidden border-l border-border bg-surface-1 xl:block",
                resizableRightPane && "channel-thread-surface",
              )}
            >
              {rightPane}
            </aside>
          ) : null}
        </>
      )}
    </div>
  );

  if (navigationOnly) {
    const navigationProps = {
      density: "mobile" as const,
      clubId,
      viewerId: user?._id ?? null,
      club,
      myClubs,
      showClubPicker,
      nav,
      pathname,
      channels,
      units: navigation?.units ?? [],
      activeChannelId,
      canCreateChannels,
      canEditChannels,
      canDeleteChannels,
      onDeleteChannel: (channel: ClubNavigationChannel) => {
        if (confirm(`Delete #${channel.name}?`)) {
          void deleteChannel({ channelId: channel._id }).then(() =>
            toast({ title: "Channel deleted" }),
          );
        }
      },
    };
    return (
      <AppShell
        headerSlot={headerSlot}
        mainClassName={FLUSH_MAIN_CLASS}
        pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
        viewportMode="visual"
      >
        {/* Phones get the exact screen a swipe from a channel uncovers: the
            same layer, over the app header, so the club page never has two
            looks depending on how you arrived. */}
        {appRoot
          ? createPortal(
              <div
                className={cn(
                  "fixed inset-x-0 top-0 bottom-[calc(3rem+max(1rem,env(safe-area-inset-bottom)))] z-[25] bg-background pt-[env(safe-area-inset-top)] md:hidden",
                  CARD_SURFACE_FOREGROUND,
                )}
              >
                <MobileClubNavigation {...navigationProps} />
              </div>,
              appRoot,
            )
          : null}
        <div className="hidden min-h-0 flex-1 md:block">
          <MobileClubNavigation {...navigationProps} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      headerSlot={headerSlot}
      mainClassName={FLUSH_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
      channelSearch={channelSearch}
      onMobileSwipeRight={openMobileNavigation}
      mobileNavigationSwipeOptions={{
        onProgress: updateMobileNavigation,
        onCancel: cancelMobileNavigation,
      }}
      viewportMode="visual"
    >
      <div className="flex min-h-0 flex-1">
        {appRoot
          ? createPortal(
              <aside
                ref={mobileNavigationRef}
                data-mobile-navigation-panel
                aria-label="Club navigation"
                aria-hidden={!mobileNavigationOpen}
                inert={!mobileNavigationOpen}
                className={cn(
                  // The bottom layer: the whole screen above the tab bar. The
                  // page layer covers it until a reveal slides that away.
                  "club-mobile-navigation fixed inset-x-0 top-0 bottom-[calc(3rem+max(1rem,env(safe-area-inset-bottom)))] z-[15] bg-background pt-[env(safe-area-inset-top)] md:hidden",
                  CARD_SURFACE_FOREGROUND,
                )}
              >
                <MobileClubNavigation
                  density="mobile"
                  clubId={clubId}
                  viewerId={user?._id ?? null}
                  club={club}
                  myClubs={myClubs}
                  showClubPicker={showClubPicker}
                  nav={nav}
                  pathname={pathname}
                  channels={channels}
                  units={navigation?.units ?? []}
                  activeChannelId={activeChannelId}
                  canCreateChannels={canCreateChannels}
                  canEditChannels={canEditChannels}
                  canDeleteChannels={canDeleteChannels}
                  onNavigate={() => settleMobileNavigation(false)}
                  onDeleteChannel={(channel) => {
                    if (confirm(`Delete #${channel.name}?`)) {
                      void deleteChannel({ channelId: channel._id }).then(() =>
                        toast({ title: "Channel deleted" }),
                      );
                    }
                  }}
                />
              </aside>,
              appRoot,
            )
          : null}

        <Sheet
          open={!!rightPane && !!mobileRightPane && !isResizablePaneViewport}
          onOpenChange={(open) => {
            if (!open) mobileRightPane?.onClose();
          }}
        >
          <SheetContent
            side="right"
            className={cn(
              // The pane brings its own close control in its header.
              "w-full max-w-none border-l bg-card p-0 pb-[env(safe-area-inset-bottom)] sm:w-[26rem] sm:pt-[env(safe-area-inset-top)] xl:hidden [&>button]:hidden",
              CARD_SURFACE_FOREGROUND,
            )}
          >
            <SheetTitle className="sr-only">
              {mobileRightPane?.title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Read and reply to this message thread.
            </SheetDescription>
            {rightPane}
          </SheetContent>
        </Sheet>

        {isResizableNavigationViewport ? (
          <ResizablePanelGroup
            id="club-workspace-layout"
            orientation="horizontal"
            defaultLayout={{
              "club-navigation-panel": 20,
              "club-workspace-main-panel": 80,
            }}
            className="h-full min-h-0 min-w-0"
          >
            <ResizablePanel
              id="club-navigation-panel"
              defaultSize="20%"
              minSize="13rem"
              maxSize="32%"
              style={{ overflow: "hidden" }}
            >
              <aside className="h-full min-h-0">
                {desktopNavigation}
              </aside>
            </ResizablePanel>
            <ResizableHandle id="club-navigation-handle" withHandle />
            <ResizablePanel
              id="club-workspace-main-panel"
              defaultSize="80%"
              minSize="0"
              style={{ overflow: "hidden" }}
            >
              {workspaceContent}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            <aside className="hidden w-60 shrink-0 md:block">
              {desktopNavigation}
            </aside>
            {workspaceContent}
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Swiping left on the revealed club list slides the page layer back over it.
 * The finger maps 1:1 to the page's travel; release past 28% of the width (or
 * a quick flick) closes, anything less springs back open.
 */
function useCloseSwipe(
  panelRef: RefObject<HTMLElement | null>,
  ready: unknown,
  {
    onProgress,
    onSettle,
  }: { onProgress: (progress: number) => void; onSettle: (open: boolean) => void },
) {
  const callbacks = useRef({ onProgress, onSettle });
  useEffect(() => {
    callbacks.current = { onProgress, onSettle };
  }, [onProgress, onSettle]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let start: { x: number; y: number; at: number; claimed: boolean } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      start =
        event.touches.length === 1
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY, at: event.timeStamp, claimed: false }
          : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!start) return;
      const deltaX = event.touches[0].clientX - start.x;
      const deltaY = Math.abs(event.touches[0].clientY - start.y);
      if (!start.claimed) {
        if (deltaX < 0 && -deltaX > deltaY * 1.4) start.claimed = true;
        else {
          if (Math.max(-deltaX, deltaY) >= 10) start = null;
          return;
        }
      }
      if (!event.cancelable) {
        start = null;
        callbacks.current.onSettle(true);
        return;
      }
      event.preventDefault();
      callbacks.current.onProgress(Math.max(0, Math.min(1, 1 + deltaX / window.innerWidth)));
    };
    const onTouchEnd = (event: TouchEvent) => {
      const finished = start;
      start = null;
      if (!finished?.claimed) return;
      const deltaX = event.changedTouches[0].clientX - finished.x;
      const velocity = deltaX / Math.max(1, event.timeStamp - finished.at);
      callbacks.current.onSettle(!(deltaX < -window.innerWidth * 0.28 || velocity < -0.5));
    };
    const onTouchCancel = () => {
      if (start?.claimed) callbacks.current.onSettle(true);
      start = null;
    };

    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd, { passive: true });
    panel.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", onTouchEnd);
      panel.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [panelRef, ready]);
}

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
};

type ClubNavigationPanelProps = {
  density: "desktop" | "mobile";
  bordered?: boolean;
  clubId: Id<"clubs">;
  viewerId: string | null;
  club?: ClubWorkspaceNavigation["club"];
  myClubs: ClubWorkspaceNavigation["myClubs"];
  showClubPicker: boolean;
  nav: NavigationItem[];
  pathname: string;
  channels: ClubNavigationChannel[];
  units: ClubWorkspaceNavigation["units"];
  activeChannelId?: string;
  canCreateChannels: boolean;
  canEditChannels: boolean;
  canDeleteChannels: boolean;
  onNavigate?: () => void;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
  hideBrowseClubs?: boolean;
  hideClubHeader?: boolean;
  /** Phones: the list is only channels, so it carries no "Channels" heading;
   *  creating one moves to the screen's header. */
  hideChannelsHeading?: boolean;
  sidebarClassName?: string;
};

/**
 * Phones: the club is a full screen of its own, like a chat app's server
 * list. The rail switches clubs; the title ("Club name ›") opens the club's
 * page (overview and people), so those don't repeat as rows here.
 */
function MobileClubNavigation(props: ClubNavigationPanelProps) {
  const clubRoot = clubHref(props.clubId);
  const nav = props.nav.filter(
    (item) => item.href !== clubRoot && item.href !== clubPeopleHref(props.clubId),
  );
  return (
    <div
      className={cn("flex size-full min-h-0 bg-background", CARD_SURFACE_FOREGROUND)}
    >
      <ClubRail
        clubId={props.clubId}
        myClubs={props.myClubs}
        onNavigate={props.onNavigate}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 pl-4 pr-2">
          {props.club ? (
            <DisclosureTitle
              as="h2"
              href={clubRoot}
              onClick={props.onNavigate}
              title={props.club.name}
              aria-label={`${props.club.name} overview and people`}
            />
          ) : (
            <Skeleton className="h-5 w-32" />
          )}
          {props.canCreateChannels ? (
            <CreateChannelTrigger clubId={props.clubId} />
          ) : null}
        </div>
        <div className="min-h-0 flex-1">
          <ClubNavigationPanel
            {...props}
            nav={nav}
            showClubPicker={false}
            hideBrowseClubs
            hideClubHeader
            hideChannelsHeading
            sidebarClassName="bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function ClubRail({
  clubId,
  myClubs,
  onNavigate,
}: Pick<ClubNavigationPanelProps, "clubId" | "myClubs" | "onNavigate">) {
  const clubEntryHref = useClubEntryHref();
  return (
    <nav
      aria-label="Your clubs"
      className="flex w-16 shrink-0 flex-col items-center border-r border-border/70 bg-muted/45 py-2"
    >
      <ScrollArea className="min-h-0 w-full flex-1">
        <div className="flex flex-col items-center gap-2 px-2">
          {myClubs.map((entry) => {
            const active = entry._id === clubId;
            return (
              <Link
                key={entry._id}
                href={clubEntryHref(entry._id)}
                onClick={onNavigate}
                aria-label={entry.name}
                aria-current={active ? "page" : undefined}
                className={cn(
                  CARD_SURFACE_FOREGROUND,
                  "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-xs font-semibold text-primary outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-active text-foreground",
                )}
              >
                {entry.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.logoUrl ?? undefined}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  entry.name.charAt(0).toUpperCase()
                )}
              </Link>
            );
          })}
        </div>
      </ScrollArea>
      <Link
        href={CLUBS_HREF}
        onClick={onNavigate}
        aria-label="Browse clubs"
        className="mt-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Compass className="size-5" />
      </Link>
    </nav>
  );
}

function ClubNavigationPanel({
  density,
  bordered = false,
  clubId,
  viewerId,
  club,
  myClubs,
  showClubPicker,
  nav,
  pathname,
  channels,
  units,
  activeChannelId,
  canCreateChannels,
  canEditChannels,
  canDeleteChannels,
  onNavigate,
  onDeleteChannel,
  hideBrowseClubs = false,
  hideClubHeader = false,
  hideChannelsHeading = false,
  sidebarClassName,
}: ClubNavigationPanelProps) {
  const activeClubIndex = myClubs.findIndex((entry) => entry._id === clubId);
  const [openUnitIds, setOpenUnitIds] = useState<string[]>([]);
  const unitStateKey = viewerId
    ? `club:${clubId}:user:${viewerId}:open-channel-units`
    : null;
  const [unitStateLoadedFor, setUnitStateLoadedFor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    try {
      const stored = unitStateKey
        ? window.localStorage.getItem(unitStateKey)
        : null;
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setOpenUnitIds(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [],
      );
    } catch {
      setOpenUnitIds([]);
    }
    setUnitStateLoadedFor(unitStateKey);
  }, [unitStateKey]);

  useEffect(() => {
    if (!unitStateKey || unitStateLoadedFor !== unitStateKey) return;
    try {
      window.localStorage.setItem(unitStateKey, JSON.stringify(openUnitIds));
    } catch {
      // Local navigation should remain fully usable if storage is unavailable.
    }
  }, [openUnitIds, unitStateKey, unitStateLoadedFor]);

  useEffect(() => {
    if (unitStateLoadedFor !== unitStateKey || !activeChannelId) return;
    const ownerUnitId = channels.find(
      (channel) => channel._id === activeChannelId,
    )?.ownerUnitId;
    if (!ownerUnitId) return;
    const toOpen = ancestorIds(units, ownerUnitId);
    setOpenUnitIds((currentIds) =>
      toOpen.every((id) => currentIds.includes(id))
        ? currentIds
        : [...new Set([...currentIds, ...toOpen])],
    );
  }, [activeChannelId, channels, unitStateKey, unitStateLoadedFor, units]);

  return (
    <WorkspaceSidebar
      aria-label="Club pages and channels"
      bordered={bordered}
      className={sidebarClassName}
      header={!hideClubHeader ? (
        <div className="flex min-w-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            {showClubPicker ? (
              <SidebarMenu>
              <SidebarMenuItem>
              <DropdownMenu>
                <DropdownTrigger
                  render={
                    <SidebarMenuButton size="lg" aria-label={club?.name ?? "Choose a club"}>
                      <ClubIdentity club={club} showPickerIndicator />
                    </SidebarMenuButton>
                  }
                />
                <DropdownContent
                  align="start"
                  checkedIndex={activeClubIndex >= 0 ? activeClubIndex : undefined}
                  className="w-96 max-w-[calc(100vw-2rem)]"
                >
                  {myClubs.length > 0 ? (
                    myClubs.map((entry, index) => (
                      <ClubPickerItem
                        key={entry._id}
                        club={entry}
                        active={entry._id === clubId}
                        index={index}
                      />
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No club memberships yet.
                    </div>
                  )}
                </DropdownContent>
              </DropdownMenu>
              </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <div className="flex min-h-11 w-full items-center gap-2 px-2" aria-label="Current club">
                <ClubIdentity club={club} />
              </div>
            )}
          </div>
        </div>
      ) : undefined}
      footer={!hideBrowseClubs ? (
        <SidebarMenu>
          <WorkspaceSidebarItem
            href={CLUBS_HREF}
            onClick={onNavigate}
            icon={Compass}
            label="Browse clubs"
            className={density === "mobile" ? "min-h-9" : undefined}
          />
        </SidebarMenu>
      ) : undefined}
    >
      {nav.length > 0 ? (
      <SidebarGroup>
      <SidebarMenu aria-label="Club pages">
        {nav.map((item) => (
          <WorkspaceSidebarItem
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            label={item.label}
            icon={item.icon}
            selected={item.match(pathname)}
            className={density === "mobile" ? "min-h-9" : undefined}
          />
        ))}
      </SidebarMenu>
      </SidebarGroup>
      ) : null}

      <WorkspaceSidebarSection
        title="Channels"
        titleHidden={hideChannelsHeading}
        action={
          canCreateChannels && !hideChannelsHeading ? (
            <CreateChannelTrigger clubId={clubId} />
          ) : undefined
        }
      >
        {!club ? (
          <div className="flex flex-col gap-2 p-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-7 w-full" />
            ))}
          </div>
        ) : channels.length > 0 ? (
          <ChannelRows
            clubId={clubId}
            channels={channels.filter((channel) => !channel.ownerUnitId)}
            activeChannelId={activeChannelId}
            density={density}
            onNavigate={onNavigate}
            canEditChannels={canEditChannels}
            canDeleteChannels={canDeleteChannels}
            onDeleteChannel={onDeleteChannel}
          >
            {units
              .filter((unit) => !unit.parentUnitId)
              .map((unit) => (
                <UnitChannelTree
                  key={unit._id}
                  unit={unit}
                  units={units}
                  channels={channels}
                  clubId={clubId}
                  activeChannelId={activeChannelId}
                  density={density}
                  onNavigate={onNavigate}
                  canEditChannels={canEditChannels}
                  canDeleteChannels={canDeleteChannels}
                  onDeleteChannel={onDeleteChannel}
                  openUnitIds={openUnitIds}
                  onOpenChange={(unitId, open) =>
                    setOpenUnitIds((current) =>
                      open
                        ? [...new Set([...current, unitId])]
                        : current.filter((id) => id !== unitId),
                    )
                  }
                />
              ))}
          </ChannelRows>
        ) : (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No channels yet.
          </div>
        )}
      </WorkspaceSidebarSection>
    </WorkspaceSidebar>
  );
}

type ChannelRowsProps = {
  clubId: Id<"clubs">;
  channels: ClubNavigationChannel[];
  activeChannelId?: string;
  density: "desktop" | "mobile";
  onNavigate?: () => void;
  canEditChannels: boolean;
  canDeleteChannels: boolean;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
  children?: ReactNode;
};

function ChannelRows({
  clubId,
  channels,
  activeChannelId,
  density,
  onNavigate,
  canEditChannels,
  canDeleteChannels,
  onDeleteChannel,
  children,
}: ChannelRowsProps) {
  return (
    <>
      {channels.length > 0 ? (
        <CardGroup
          orientation="inline"
          separated
          proximityHover={density !== "mobile"}
          className="gap-0.5"
        >
          {channels.map((channel) => (
            <ChannelRow
              key={channel._id}
              channel={channel}
              clubId={clubId}
              activeChannelId={activeChannelId}
              density={density}
              onNavigate={onNavigate}
              canEditChannels={canEditChannels}
              canDeleteChannels={canDeleteChannels}
              onDeleteChannel={onDeleteChannel}
            />
          ))}
        </CardGroup>
      ) : null}
      {children}
    </>
  );
}

function ChannelRow({
  index,
  channel,
  clubId,
  activeChannelId,
  density,
  onNavigate,
  canEditChannels,
  canDeleteChannels,
  onDeleteChannel,
  nestedChannelsExpanded,
  nestedChannelsLabel,
}: {
  index?: number;
  channel: ClubNavigationChannel;
  clubId: Id<"clubs">;
  activeChannelId?: string;
  density: "desktop" | "mobile";
  onNavigate?: () => void;
  canEditChannels: boolean;
  canDeleteChannels: boolean;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
  nestedChannelsExpanded?: boolean;
  nestedChannelsLabel?: string;
}) {
  const active = channel._id === activeChannelId;
  const mutedChannels = useMutedChannels();
  const muted = mutedChannels.has(channel._id);
  const mutedUntil = mutedChannels.get(channel._id) ?? null;
  const rowClassName =
    density === "mobile"
      ? "min-h-9"
      : "min-h-8 pointer-coarse:min-h-11";
  const secondaryControlClassName =
    density === "mobile"
      ? "flex"
      : "hidden group-hover/channel:flex group-focus-within/channel:flex";
  return (
    <Card
      index={index}
      href={clubChannelHref(clubId, channel._id)}
      onClick={() => onNavigate?.()}
      label={`Open #${channel.name}`}
      selected={active}
      className={cn(
        "group/channel gap-1.5 rounded-md px-2 text-[13px]",
        rowClassName,
        channel.hasUnreadMessages
          ? "font-semibold text-foreground"
          : "font-medium text-muted-foreground",
      )}
    >
      <div className="relative z-30 flex size-6 shrink-0 items-center justify-center">
        {nestedChannelsLabel ? (
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${nestedChannelsExpanded ? "Collapse" : "Expand"} nested channels in ${nestedChannelsLabel}`}
              className="size-6 -translate-x-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  "size-3.5",
                  nestedChannelsExpanded && "rotate-90",
                )}
              />
            </Button>
          </CollapsibleTrigger>
        ) : (
          <ClubChannelVisibilityIcon
            visibility={channel.visibility}
            aria-hidden="true"
            className="size-4 shrink-0 -translate-x-1 text-muted-foreground"
          />
        )}
      </div>
      <span
        className={cn(
          "flex min-w-0 flex-1 -translate-x-1.5 items-center gap-1",
          muted && "text-muted-foreground",
        )}
      >
        <span className="truncate">{channel.name}</span>
        {muted ? (
          <span
            className="ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs font-medium tabular-nums text-destructive"
            aria-label={
              mutedUntil
                ? `Muted, ${formatMuteRemaining(mutedUntil)} left`
                : "Muted"
            }
            role="img"
          >
            {mutedUntil ? (
              <span aria-hidden>{formatMuteRemaining(mutedUntil)}</span>
            ) : null}
            <BellOff aria-hidden className="size-3.5" />
          </span>
        ) : null}
      </span>
      <div className="relative z-30 flex shrink-0 items-center gap-0.5">
        {canEditChannels || canDeleteChannels ? (
          <div
            className={cn("items-center gap-0.5", secondaryControlClassName)}
          >
            <ChannelActionsTrigger
              clubId={clubId}
              channel={channel}
              canEdit={canEditChannels}
              canDelete={canDeleteChannels}
              onDeleteChannel={onDeleteChannel}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Whether any channel this viewer can open sits in the unit or below it. */
function unitHasVisibleChannels(
  unit: ClubWorkspaceNavigation["units"][number],
  units: ClubWorkspaceNavigation["units"],
  channels: ClubNavigationChannel[],
): boolean {
  return (
    channels.some((channel) => channel.ownerUnitId === unit._id) ||
    units.some(
      (child) =>
        child.parentUnitId === unit._id &&
        unitHasVisibleChannels(child, units, channels),
    )
  );
}

function UnitChannelTree({
  unit,
  units,
  channels,
  clubId,
  activeChannelId,
  density,
  onNavigate,
  canEditChannels,
  canDeleteChannels,
  onDeleteChannel,
  openUnitIds,
  onOpenChange,
  depth = 0,
}: {
  unit: ClubWorkspaceNavigation["units"][number];
  units: ClubWorkspaceNavigation["units"];
  channels: ClubNavigationChannel[];
  clubId: Id<"clubs">;
  activeChannelId?: string;
  density: "desktop" | "mobile";
  onNavigate?: () => void;
  canEditChannels: boolean;
  canDeleteChannels: boolean;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
  openUnitIds: string[];
  onOpenChange: (unitId: string, open: boolean) => void;
  depth?: number;
}) {
  const directChannels = channels.filter(
    (channel) => channel.ownerUnitId === unit._id,
  );
  const children = units.filter(
    (candidate) => candidate.parentUnitId === unit._id,
  );
  if (!directChannels.length && !children.length) return null;
  const expanded = openUnitIds.includes(unit._id);
  // A unit whose channels this viewer cannot open has nothing to expand.
  const reachable =
    directChannels.length > 0 ||
    children.some((child) => unitHasVisibleChannels(child, units, channels));
  // Nested units sit among channel rows, so they share their height and type.
  const unitRowClassName = cn(
    "flex w-full items-center gap-1.5 rounded-md px-2 text-[13px] font-medium",
    density === "mobile"
      ? "min-h-9"
      : "min-h-8 pointer-coarse:min-h-11",
  );
  return (
    <Collapsible
      open={reachable && expanded}
      onOpenChange={(open) => onOpenChange(unit._id, open)}
      className="space-y-0.5"
    >
      {children.length && !directChannels.length ? (
        depth === 0 ? (
          <div className="flex h-7 items-center px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {reachable ? (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <ChevronRight
                    className={cn("size-3 shrink-0", expanded && "rotate-90")}
                  />
                  <span className="truncate">{unit.name}</span>
                </button>
              </CollapsibleTrigger>
            ) : (
              <span
                className="flex min-w-0 flex-1 items-center gap-1"
                aria-label={`${unit.name}, no access`}
              >
                <span className="truncate">{unit.name}</span>
                <ClubChannelVisibilityIcon
                  visibility="PRIVATE"
                  className="size-3"
                />
              </span>
            )}
          </div>
        ) : reachable ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                unitRowClassName,
                "text-left text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                <ChevronRight
                  className={cn(
                    "size-3.5 -translate-x-1",
                    expanded && "rotate-90",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1 -translate-x-1.5 truncate">
                {unit.name}
              </span>
            </button>
          </CollapsibleTrigger>
        ) : (
          <div
            className={cn(unitRowClassName, "text-muted-foreground")}
            aria-label={`${unit.name}, no access`}
          >
            <span aria-hidden="true" className="size-6 shrink-0" />
            <span className="min-w-0 flex-1 -translate-x-1.5 truncate">
              {unit.name}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 translate-x-1 items-center justify-center"
            >
              <ClubChannelVisibilityIcon visibility="PRIVATE" />
            </span>
          </div>
        )
      ) : null}
      {directChannels.length ? (
        <CardGroup
          orientation="inline"
          separated
          proximityHover={density !== "mobile"}
          className="gap-0.5"
        >
          {directChannels.map((channel, index) => (
            <ChannelRow
              key={channel._id}
              channel={channel}
              clubId={clubId}
              activeChannelId={activeChannelId}
              density={density}
              onNavigate={onNavigate}
              canEditChannels={canEditChannels}
              canDeleteChannels={canDeleteChannels}
              onDeleteChannel={onDeleteChannel}
              nestedChannelsExpanded={index === 0 ? expanded : undefined}
              nestedChannelsLabel={
                index === 0 && children.length ? unit.name : undefined
              }
            />
          ))}
        </CardGroup>
      ) : null}
      {children.length && reachable ? (
        <CollapsibleContent>
          <div className={directChannels.length ? "ml-4 border-l" : ""}>
            {children.map((child) => (
              <UnitChannelTree
                key={child._id}
                unit={child}
                units={units}
                channels={channels}
                clubId={clubId}
                activeChannelId={activeChannelId}
                density={density}
                onNavigate={onNavigate}
                canEditChannels={canEditChannels}
                canDeleteChannels={canDeleteChannels}
                onDeleteChannel={onDeleteChannel}
                openUnitIds={openUnitIds}
                onOpenChange={onOpenChange}
                depth={depth + 1}
              />
            ))}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

function CreateChannelTrigger({ clubId }: { clubId: Id<"clubs"> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        className="size-6 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Create channel"
      >
        <Plus />
      </Button>
      <ChannelDialog clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ChannelActionsTrigger({
  clubId,
  channel,
  canEdit,
  canDelete,
  onDeleteChannel,
}: {
  clubId: Id<"clubs">;
  channel: ClubNavigationChannel;
  canEdit: boolean;
  canDelete: boolean;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
}) {
  return (
    <>
      {canEdit ? (
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="size-6 text-muted-foreground hover:text-foreground !bg-transparent"
          aria-label="Channel settings"
        >
          <Link
            href={clubChannelSettingsHref(clubId, channel._id)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <Settings />
          </Link>
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDeleteChannel(channel);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${channel.name}`}
        >
          <Trash2 />
        </Button>
      ) : null}
    </>
  );
}

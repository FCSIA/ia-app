"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  AtSign,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Compass,
  Home,
  PanelLeft,
  Plus,
  Pencil,
  Trash2,
  Users2,
} from "lucide-react";
import { ClubChannelVisibilityIcon } from "@/components/clubs/channel-visibility";
import { AppShell } from "@/components/layout/AppShell";
import { FLUSH_MAIN_CLASS } from "@/components/layout/app-main";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dropdown,
  DropdownSeparator,
  useDropdown,
} from "@/components/ui/dropdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChannelDialog } from "@/components/clubs/dialogs/channel-dialog";
import { useClubId } from "@/app/clubs/club-route";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  ClubNavigationChannel,
  ClubNavigationSummary,
  ClubWorkspaceNavigation,
} from "@/components/clubs/types";

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return url;
}

function BrowseAllClubsItem({
  index,
}: {
  index: number;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const { registerItem, activeIndex } = useDropdown();
  const isHovered = activeIndex === index;

  useEffect(() => {
    registerItem(index, ref.current);
    return () => registerItem(index, null);
  }, [index, registerItem]);
  return (
    <Link
      ref={ref}
      data-proximity-index={index}
      role="menuitemradio"
      href="/clubs"
      className={cn(
        "text-sm relative z-10 flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors",
        isHovered
          ? "text-foreground"
          : "text-muted-foreground",
      )}
    >
      Browse all clubs
    </Link>
  )
}

function ClubPickerItem({
  club,
  active,
  index,
}: {
  club: ClubNavigationSummary;
  active: boolean;
  index: number;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const { registerItem, activeIndex } = useDropdown();
  const isHovered = activeIndex === index;

  useEffect(() => {
    registerItem(index, ref.current);
    return () => registerItem(index, null);
  }, [index, registerItem]);

  return (
    <Link
      ref={ref}
      href={`/clubs/${club._id}`}
      data-proximity-index={index}
      role="menuitemradio"
      aria-checked={active}
      className={cn(
        "relative z-10 flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground",
      )}
    >
      <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-[11px] font-semibold text-primary">
        {club.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveMediaUrl(club.logoUrl)}
            alt={club.name}
            className="size-full bg-background object-cover"
          />
        ) : (
          club.name.charAt(0).toUpperCase()
        )}
      </div>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium",
          isHovered || active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {club.name}
      </span>
      {active ? <Check className="size-4 shrink-0 text-foreground" /> : null}
    </Link>
  );
}

type ClubWorkspaceProps = {
  children: ReactNode;
  rightPane?: ReactNode;
  resizableRightPane?: boolean;
  title?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
};

export function ClubWorkspace({
  children,
  rightPane,
  resizableRightPane = false,
  title,
  actions,
  contentClassName,
}: ClubWorkspaceProps) {
  const pathname = usePathname() ?? "";
  const clubId = useClubId();
  const [isResizablePaneViewport, setIsResizablePaneViewport] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    if (!resizableRightPane) return;

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncViewport = () => setIsResizablePaneViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, [resizableRightPane]);

  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, {
    clubId,
  }) as
    | ClubWorkspaceNavigation
    | undefined;
  const { toast } = useToast();
  const deleteChannel = useMutation(api.clubs.channels.remove);
  const club = navigation?.club;
  const channels = navigation?.channels ?? [];
  const myClubs = navigation?.myClubs ?? [];
  const canManageChannels = navigation?.viewer.canManageChannels ?? false;
  const activeClubIndex = myClubs.findIndex((entry) => entry._id === clubId);

  const activeChannelId = pathname.match(
    /\/clubs\/[^/]+\/channels\/([^/]+)/,
  )?.[1];

  const nav: Array<{
    href: string;
    label: string;
    icon: typeof Home;
    match: (p: string) => boolean;
  }> = [
    {
      href: `/clubs/${clubId}`,
      label: "Overview",
      icon: Home,
      match: (p) => p === `/clubs/${clubId}`,
    },
    {
      href: `/clubs/${clubId}/people`,
      label: "People",
      icon: Users2,
      match: (p) => p.startsWith(`/clubs/${clubId}/people`),
    },
    {
      href: `/clubs/${clubId}/tags`,
      label: "Tags",
      icon: AtSign,
      match: (p) => p.startsWith(`/clubs/${clubId}/tags`),
    },
  ];

  const headerSlot = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 md:hidden"
          aria-label="Open club channels"
          onClick={() => setMobileNavigationOpen(true)}
        >
          <PanelLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          {title ?? (
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {club?.name ?? "Club"}
            </h1>
          )}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );

  return (
    <AppShell
      headerSlot={headerSlot}
      mainClassName={FLUSH_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-muted/45 md:block">
          <ClubNavigationPanel
            density="desktop"
            clubId={clubId}
            club={club}
            myClubs={myClubs}
            activeClubIndex={activeClubIndex}
            nav={nav}
            pathname={pathname}
            channels={channels}
            activeChannelId={activeChannelId}
            canManageChannels={canManageChannels}
            onDeleteChannel={(channel) => {
              if (confirm(`Delete #${channel.name}?`)) {
                void deleteChannel({ channelId: channel._id }).then(() =>
                  toast({ title: "Channel deleted" }),
                );
              }
            }}
          />
        </aside>

        <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
          <SheetContent side="left" className="w-72 border-r bg-card p-0">
            <SheetTitle className="sr-only">Club navigation</SheetTitle>
            <ClubNavigationPanel
              density="mobile"
              clubId={clubId}
              club={club}
              myClubs={myClubs}
              activeClubIndex={activeClubIndex}
              nav={nav}
              pathname={pathname}
              channels={channels}
              activeChannelId={activeChannelId}
              canManageChannels={canManageChannels}
              onNavigate={() => setMobileNavigationOpen(false)}
              onDeleteChannel={(channel) => {
                if (confirm(`Delete #${channel.name}?`)) {
                  void deleteChannel({ channelId: channel._id }).then(() =>
                    toast({ title: "Channel deleted" }),
                  );
                }
              }}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-1">
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
                <div
                  className={cn(
                    "h-full min-h-0 min-w-0 overflow-y-auto",
                    contentClassName,
                  )}
                >
                  {children}
                </div>
              </ResizablePanel>
              <ResizableHandle id="club-channel-thread-handle" withHandle />
              <ResizablePanel
                id="club-channel-thread-panel"
                defaultSize="32%"
                minSize="18rem"
                maxSize="45%"
                style={{ overflow: "hidden" }}
              >
                <aside className="h-full min-h-0 overflow-hidden">{rightPane}</aside>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <>
              <div
                className={cn(
                  "min-h-0 min-w-0 flex-1 overflow-y-auto",
                  contentClassName,
                )}
              >
                {children}
              </div>
              {rightPane ? (
                <aside className="hidden w-80 shrink-0 overflow-hidden border-l xl:block">
                  {rightPane}
                </aside>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
};

function ClubNavigationPanel({
  density,
  clubId,
  club,
  myClubs,
  activeClubIndex,
  nav,
  pathname,
  channels,
  activeChannelId,
  canManageChannels,
  onNavigate,
  onDeleteChannel,
}: {
  density: "desktop" | "mobile";
  clubId: Id<"clubs">;
  club?: ClubWorkspaceNavigation["club"];
  myClubs: ClubWorkspaceNavigation["myClubs"];
  activeClubIndex: number;
  nav: NavigationItem[];
  pathname: string;
  channels: ClubNavigationChannel[];
  activeChannelId?: string;
  canManageChannels: boolean;
  onNavigate?: () => void;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
}) {
  const rowClassName = density === "mobile" ? "min-h-11" : "min-h-8";

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/70 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                {club?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveMediaUrl(club.logoUrl)}
                    alt={club.name}
                    className="size-full bg-background object-cover"
                  />
                ) : (
                  (club?.name?.charAt(0).toUpperCase() ?? "C")
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {club?.name ?? "Loading…"}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-0 bg-transparent p-0 shadow-none">
            <Dropdown
              checkedIndex={activeClubIndex >= 0 ? activeClubIndex : undefined}
              className="w-64"
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
              <DropdownSeparator className="!mx-1" />
              <BrowseAllClubsItem index={myClubs.length} />
            </Dropdown>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          <nav className="space-y-0.5" aria-label="Club pages">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    rowClassName,
                    active
                      ? "bg-active text-foreground"
                      : "text-muted-foreground hover:bg-hover hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="my-3 h-px bg-border/70" />

          <section aria-labelledby={`channels-${density}`}>
            <div className="mb-0.5 flex h-7 items-center justify-between px-2">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ChevronDown className="size-3" />
                <h2
                  id={`channels-${density}`}
                  className="text-[11px] font-bold uppercase tracking-wide"
                >
                  Channels
                </h2>
              </div>
              {canManageChannels ? <CreateChannelTrigger clubId={clubId} /> : null}
            </div>

            <div className="space-y-0.5">
              {channels.length > 0 ? (
                channels.map((channel) => {
                  const active = channel._id === activeChannelId;
                  return (
                    <Link
                      key={channel._id}
                      href={`/clubs/${clubId}/channels/${channel._id}`}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-1.5 rounded-md px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        rowClassName,
                        active
                          ? "bg-active text-foreground"
                          : "text-muted-foreground hover:bg-hover hover:text-foreground",
                      )}
                    >
                      <ClubChannelVisibilityIcon
                        visibility={channel.visibility}
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-foreground/70" : "text-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                      {canManageChannels ? (
                        <div className="flex shrink-0 items-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <ChannelActionsTrigger clubId={clubId} channel={channel} />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onDeleteChannel(channel);
                            }}
                            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${channel.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </Link>
                  );
                })
              ) : (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No channels yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>

      <Link
        href="/clubs"
        onClick={onNavigate}
        className="flex min-h-11 shrink-0 items-center gap-2 border-t border-border/70 px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
      >
        <Compass className="size-4" />
        Browse clubs
      </Link>
    </div>
  );
}

function CreateChannelTrigger({ clubId }: { clubId: Id<"clubs"> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="size-5 rounded text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Create channel"
      >
        <Plus className="size-3.5" />
      </Button>
      <ChannelDialog clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ChannelActionsTrigger({
  clubId,
  channel,
}: {
  clubId: Id<"clubs">;
  channel: ClubNavigationChannel;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="p-1 hover:bg-muted rounded transition-all"
        aria-label="Edit channel"
      >
        <Pencil className="size-3" />
      </button>
      <ChannelDialog
        clubId={clubId}
        channel={channel}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

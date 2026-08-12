"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  ChevronDown,
  ChevronsUpDown,
  Compass,
  Home,
  PanelLeft,
  Plus,
  Pencil,
  Settings,
  Trash2,
  Users2,
} from "lucide-react";
import { ClubChannelVisibilityIcon } from "@/components/clubs/channel-visibility";
import { AppShell } from "@/components/layout/AppShell";
import type { ChannelSearchControl } from "@/components/layout/AppShell";
import { FLUSH_MAIN_CLASS } from "@/components/layout/app-main";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Card, CardAction, CardGroup } from "@/components/ui/card";
import { MenuItem } from "@/components/ui/menu-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChannelDialog } from "@/components/clubs/dialogs/channel-dialog";
import { useClubId } from "@/app/clubs/club-route";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin, useCurrentUser } from "@/lib/auth";
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
          src={resolveMediaUrl(club.logoUrl)}
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
      onSelect={() => router.push(`/clubs/${club._id}`)}
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
  return (
    <>
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
      {showPickerIndicator ? (
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );
}

type ClubWorkspaceProps = {
  children: ReactNode;
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
  const canCreateChannels = navigation?.viewer.canCreateChannels ?? false;
  const canEditChannels = navigation?.viewer.canEditChannels ?? false;
  const canDeleteChannels = navigation?.viewer.canDeleteChannels ?? false;
  const showClubPicker = !isSuperAdmin(user);

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
    ...(navigation?.viewer.canManageRoles || navigation?.viewer.canManageClubStructure
      ? [{
          href: `/clubs/${clubId}/settings`,
          label: "Settings",
          icon: Settings,
          match: (p: string) => p.startsWith(`/clubs/${clubId}/settings`),
        }]
      : []),
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
      channelSearch={channelSearch}
      onMobileSwipeRight={() => setMobileNavigationOpen(true)}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-muted/45 md:block">
          <ClubNavigationPanel
            density="desktop"
            clubId={clubId}
            club={club}
            myClubs={myClubs}
            showClubPicker={showClubPicker}
            nav={nav}
            pathname={pathname}
            channels={channels}
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
        </aside>

        <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
          <SheetContent side="left" className="w-72 border-r bg-card p-0">
            <SheetTitle className="sr-only">Club navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Browse this club and its channels.
            </SheetDescription>
            <ClubNavigationPanel
              density="mobile"
              clubId={clubId}
              club={club}
              myClubs={myClubs}
              showClubPicker={showClubPicker}
              nav={nav}
              pathname={pathname}
              channels={channels}
              activeChannelId={activeChannelId}
              canCreateChannels={canCreateChannels}
              canEditChannels={canEditChannels}
              canDeleteChannels={canDeleteChannels}
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

        <Sheet
          open={!!rightPane && !!mobileRightPane && !isResizablePaneViewport}
          onOpenChange={(open) => {
            if (!open) mobileRightPane?.onClose();
          }}
        >
          <SheetContent
            side="right"
            className="w-full max-w-none border-l bg-card p-0 sm:w-[26rem] xl:hidden"
          >
            <SheetTitle className="sr-only">{mobileRightPane?.title}</SheetTitle>
            <SheetDescription className="sr-only">
              Read and reply to this message thread.
            </SheetDescription>
            {rightPane}
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
                <aside className="h-full min-h-0 overflow-hidden">{rightPane}</aside>
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
  showClubPicker,
  nav,
  pathname,
  channels,
  activeChannelId,
  canCreateChannels,
  canEditChannels,
  canDeleteChannels,
  onNavigate,
  onDeleteChannel,
}: {
  density: "desktop" | "mobile";
  clubId: Id<"clubs">;
  club?: ClubWorkspaceNavigation["club"];
  myClubs: ClubWorkspaceNavigation["myClubs"];
  showClubPicker: boolean;
  nav: NavigationItem[];
  pathname: string;
  channels: ClubNavigationChannel[];
  activeChannelId?: string;
  canCreateChannels: boolean;
  canEditChannels: boolean;
  canDeleteChannels: boolean;
  onNavigate?: () => void;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
}) {
  const rowClassName = density === "mobile" ? "min-h-11" : "min-h-8";
  const channelRowClassName = density === "mobile" ? "min-h-9" : "min-h-8";
  const activeClubIndex = myClubs.findIndex((entry) => entry._id === clubId);

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div
        className={cn(
          "shrink-0 border-b border-border/70 p-2",
          density === "mobile" && "pr-12",
        )}
      >
        {showClubPicker ? (
          <DropdownMenu>
            <DropdownTrigger
              render={
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded-md bg-surface-2 px-2 text-left shadow-surface-1 outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ClubIdentity club={club} showPickerIndicator />
                </button>
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
        ) : (
          <div
            className="flex min-h-10 w-full items-center gap-2 rounded-md bg-surface-2 px-2 shadow-surface-1"
            aria-label="Current club"
          >
            <ClubIdentity club={club} />
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          <CardGroup
            orientation="inline"
            separated
            className="gap-0.5"
            aria-label="Club pages"
          >
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Card
                  key={item.href}
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  label={item.label}
                  selected={active}
                  className={cn(
                    "gap-2 rounded-md px-2 text-sm font-medium",
                    rowClassName,
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Card>
              );
            })}
          </CardGroup>

          <div className="my-3 h-px bg-border/70" />

          <section aria-labelledby={`channels-${density}`}>
            <div className="flex h-7 items-center justify-between pl-2 pr-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <ChevronDown className="size-3" />
                <h2
                  id={`channels-${density}`}
                  className="text-[11px] font-bold uppercase tracking-wide"
                >
                  Channels
                </h2>
              </div>
              {canCreateChannels ? <CreateChannelTrigger clubId={clubId} /> : null}
            </div>

            {channels.length > 0 ? (
              <CardGroup orientation="inline" separated className="gap-0.5">
                {channels.map((channel) => {
                  const active = channel._id === activeChannelId;
                  return (
                    <Card
                      key={channel._id}
                      href={`/clubs/${clubId}/channels/${channel._id}`}
                      onClick={() => onNavigate?.()}
                      label={`Open #${channel.name}`}
                      selected={active}
                      className={cn(
                        "group gap-1.5 rounded-md px-2 text-sm font-medium",
                        channelRowClassName,
                        active ? "text-foreground" : "text-muted-foreground",
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
                      {canEditChannels || canDeleteChannels ? (
                        <CardAction className="flex shrink-0 items-center gap-0.5 translate-y-1 translate-x-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <ChannelActionsTrigger
                            clubId={clubId}
                            channel={channel}
                            canEdit={canEditChannels}
                            canDelete={canDeleteChannels}
                            onDeleteChannel={onDeleteChannel}
                          />
                        </CardAction>
                      ) : null}
                    </Card>
                  );
                })}
              </CardGroup>
            ) : (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No channels yet.
              </div>
            )}
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
  onDeleteChannel
}: {
  clubId: Id<"clubs">;
  channel: ClubNavigationChannel;
  canEdit: boolean;
  canDelete: boolean;
  onDeleteChannel: (channel: ClubNavigationChannel) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {canEdit ? <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="size-6 text-muted-foreground hover:text-foreground !bg-transparent"
        aria-label="Edit channel"
      >
        <Pencil />
      </Button> : null}
      {canDelete ? <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDeleteChannel(channel);
        }}
        className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${channel.name}`}
      >
        <Trash2 />
      </Button> : null}
      {canEdit ? <ChannelDialog
        clubId={clubId}
        channel={channel}
        open={open}
        onOpenChange={setOpen}
      /> : null}
    </>
  );
}

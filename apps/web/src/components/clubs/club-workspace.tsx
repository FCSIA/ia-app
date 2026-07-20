"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  AtSign,
  Check,
  ChevronsUpDown,
  Home,
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
  title?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
};

export function ClubWorkspace({
  children,
  rightPane,
  title,
  actions,
  contentClassName,
}: ClubWorkspaceProps) {
  const pathname = usePathname() ?? "";
  const clubId = useClubId();

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
      <div className="min-w-0 flex-1">
        {title ?? (
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {club?.name ?? "Club"}
          </h1>
        )}
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
        <aside className="hidden w-72 shrink-0 flex-col border-r bg-muted/30 md:flex">
          <div className="border-b px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {club?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(club.logoUrl)}
                        alt={club.name}
                        className="size-full object-cover bg-background"
                      />
                    ) : (
                      (club?.name?.charAt(0).toUpperCase() ?? "C")
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {club?.name ?? "Loading…"}
                    </p>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="border-0 bg-transparent p-0 shadow-none"
              >
                <Dropdown
                  checkedIndex={
                    activeClubIndex >= 0 ? activeClubIndex : undefined
                  }
                  itemShapeClassName="rounded-lg"
                  className="w-64 !rounded-lg"
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
                  <DropdownSeparator />
                  <Link
                    href="/clubs"
                    className="relative z-10 flex rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Browse all clubs
                  </Link>
                </Dropdown>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-3">
              <nav className="space-y-0.5">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = item.match(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div>
                <div className="mb-1 flex items-center justify-between px-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Channels
                  </p>
                  {canManageChannels ? (
                    <CreateChannelTrigger clubId={clubId} />
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {channels.length > 0 ? (
                    channels.map((channel) => {
                      const active = channel._id === activeChannelId;
                      return (
                        <Link
                          key={channel._id}
                          href={`/clubs/${clubId}/channels/${channel._id}`}
                          className={cn(
                            "group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <ClubChannelVisibilityIcon
                            visibility={channel.visibility}
                            className="size-3.5 text-muted-foreground"
                          />
                          <span className="flex-1 truncate">
                            {channel.name}
                          </span>
                          {canManageChannels && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChannelActionsTrigger
                                clubId={clubId}
                                channel={channel}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      `Are you sure you want to delete #${channel.name}?`,
                                    )
                                  ) {
                                    void deleteChannel({
                                      channelId: channel._id,
                                    }).then(() =>
                                      toast({ title: "Channel deleted" }),
                                    );
                                  }
                                }}
                                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                aria-label="Delete channel"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <p className="px-2.5 py-2 text-xs text-muted-foreground">
                      No channels yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1">
          <div
            className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", contentClassName)}
          >
            {children}
          </div>
          {rightPane ? (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l xl:block">
              {rightPane}
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
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

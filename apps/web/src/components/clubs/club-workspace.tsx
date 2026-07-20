"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  AtSign,
  Check,
  ChevronDown,
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}: {
  club: ClubNavigationSummary;
  active: boolean;
}) {
  return (
    <DropdownMenuItem
      asChild
      className={cn(
        "group flex min-w-0 items-center gap-3 !rounded-[calc(var(--radius)-4px)] px-2.5 py-2.5 text-foreground outline-none transition-[background-color,color] duration-150 data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
        active
          ? "bg-primary/10 data-[highlighted]:bg-primary/15"
          : "bg-transparent",
      )}
    >
      <Link
        href={`/clubs/${club._id}`}
        aria-current={active ? "page" : undefined}
      >
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius)-6px)] border border-primary/15 bg-primary/10 text-xs font-semibold text-primary">
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
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {club.name}
        </span>
        {active ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[calc(var(--radius)-8px)] bg-primary/10 text-primary">
            <Check aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Current club</span>
          </span>
        ) : null}
      </Link>
    </DropdownMenuItem>
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
          <div className="border-b p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex min-h-16 w-full items-center gap-3 rounded-[var(--radius)] border border-border/70 bg-card px-2.5 py-2 text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/35 hover:bg-muted/50 focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-ring/30 data-[state=open]:border-primary/45 data-[state=open]:bg-muted/60 data-[state=open]:shadow-sm"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[calc(var(--radius)-4px)] border border-primary/15 bg-primary/10 text-sm font-semibold text-primary">
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {club?.name ?? "Loading…"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Switch club
                    </p>
                  </div>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-6px)] bg-muted text-muted-foreground transition-[background-color,color,transform] duration-150 group-hover:bg-primary/10 group-hover:text-primary group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary">
                    <ChevronDown className="size-4 transition-transform duration-150 group-data-[state=open]:rotate-180" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[min(21rem,calc(100vw-2rem))] !rounded-[var(--radius)] border-border/80 bg-popover p-1.5 shadow-[0_18px_48px_hsl(var(--foreground)/0.16)]"
              >
                <DropdownMenuLabel className="px-2.5 pb-2 pt-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Your clubs
                </DropdownMenuLabel>
                {myClubs.length > 0 ? (
                  myClubs.map((entry) => (
                    <ClubPickerItem
                      key={entry._id}
                      club={entry}
                      active={entry._id === clubId}
                    />
                  ))
                ) : (
                  <div className="px-2.5 py-2 text-sm text-muted-foreground">
                    No club memberships yet.
                  </div>
                )}
                <DropdownMenuSeparator className="mx-1 my-1.5 bg-border/70" />
                <DropdownMenuItem
                  asChild
                  className="group !rounded-[calc(var(--radius)-4px)] px-2.5 py-2.5 text-muted-foreground transition-[background-color,color] duration-150 data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
                >
                  <Link href="/clubs">
                    <span className="flex-1">Browse all clubs</span>
                    <ChevronDown className="size-4 -rotate-90 transition-transform duration-150 group-data-[highlighted]:translate-x-0.5" />
                  </Link>
                </DropdownMenuItem>
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

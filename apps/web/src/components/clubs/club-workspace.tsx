'use client';

import { type ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  Check,
  ChevronsUpDown,
  Hash,
  Home,
  Lock,
  Plus,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateChannelDialog } from '@/components/clubs/dialogs/create-channel-dialog';
import { clubsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { ClubDetail, ClubSummary } from '@ia/contracts/clubs';

type MyClubsResponse = {
  memberOf: ClubSummary[];
  sponsoring: ClubSummary[];
};

type ClubWorkspaceProps = {
  clubId: string;
  children: ReactNode;
  rightPane?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
};

export function ClubWorkspace({
  clubId,
  children,
  rightPane,
  title,
  actions,
  contentClassName,
}: ClubWorkspaceProps) {
  const pathname = usePathname() ?? '';
  const user = useCurrentUser();

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', clubId],
    queryFn: () => clubsApi.getOne(clubId).then((response) => response.data),
  });

  const { data: myData } = useQuery<MyClubsResponse>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((response) => response.data),
  });

  const channels = club?.channels ?? [];
  const myClubs = useMemo(() => {
    const entries = [
      ...(myData?.memberOf ?? []),
      ...(myData?.sponsoring ?? []),
    ];
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }, [myData]);

  const isAdmin = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const isSponsor = club?.sponsors?.some((sponsor) => sponsor.userId === user?.id);
  const myMembership = club?.members?.find((member) => member.userId === user?.id);
  const canManageChannels = isSponsor || !!myMembership?.role || isAdmin;

  const activeChannelId = pathname.match(/\/clubs\/[^/]+\/channels\/([^/]+)/)?.[1];

  const nav: Array<{ href: string; label: string; icon: typeof Home; match: (p: string) => boolean }> = [
    {
      href: `/clubs/${clubId}`,
      label: 'Overview',
      icon: Home,
      match: (p) => p === `/clubs/${clubId}`,
    },
    {
      href: `/clubs/${clubId}/people`,
      label: 'People',
      icon: Users2,
      match: (p) => p.startsWith(`/clubs/${clubId}/people`),
    },
    {
      href: `/clubs/${clubId}/tags`,
      label: 'Tags',
      icon: AtSign,
      match: (p) => p.startsWith(`/clubs/${clubId}/tags`),
    },
  ];

  const headerSlot = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        {title ?? (
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {club?.name ?? 'Club'}
          </h1>
        )}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );

  return (
    <AppShell headerSlot={headerSlot} mainClassName="flex h-[calc(100vh-4rem)] min-h-0">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r bg-background md:flex">
          <div className="border-b p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                    {club?.name?.charAt(0).toUpperCase() ?? 'C'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {club?.name ?? 'Loading…'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {club?._count?.members ?? club?.members?.length ?? 0} members
                    </p>
                  </div>
                  <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Your clubs
                </DropdownMenuLabel>
                {myClubs.length > 0 ? (
                  myClubs.map((entry) => (
                    <DropdownMenuItem key={entry.id} asChild>
                      <Link href={`/clubs/${entry.id}`} className="cursor-pointer">
                        <div className="flex size-6 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{entry.name}</span>
                        {entry.id === clubId ? (
                          <Check className="size-4 text-muted-foreground" />
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No club memberships yet.
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/clubs" className="cursor-pointer">
                    Browse all clubs
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
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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
                      const active = channel.id === activeChannelId;
                      return (
                        <Link
                          key={channel.id}
                          href={`/clubs/${clubId}/channels/${channel.id}`}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                            active
                              ? 'bg-muted font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          {channel.isPrivate ? (
                            <Lock className="size-3.5 shrink-0" />
                          ) : (
                            <Hash className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate">{channel.name}</span>
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

        <div className="flex min-w-0 flex-1">
          <div className={cn('min-w-0 flex-1 overflow-y-auto', contentClassName)}>
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

function CreateChannelTrigger({ clubId }: { clubId: string }) {
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
      <CreateChannelDialog clubId={clubId} open={open} onOpenChange={setOpen} />
    </>
  );
}

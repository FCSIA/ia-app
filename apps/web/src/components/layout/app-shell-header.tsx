import { displayName } from '~/apps/shared/user-name';
import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  LogOut,
  Search,
  Settings,
} from "lucide-react";

import type { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { MenuItem } from "@/components/ui/menu-item";
import { Tooltip } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceAvatar } from "@/components/presence/club-presence";
import { useDoNotDisturbMenu } from "@/components/presence/do-not-disturb";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";

export type ChannelSearchControl = {
  channelName: string;
  value: string;
  onValueChange: (value: string) => void;
};

export type SearchScope = "everything" | "channel";

type AppShellHeaderProps = {
  headerSlot?: ReactNode;
  channelSearch?: ChannelSearchControl;
  searchScope: SearchScope;
  commandHint: boolean;
  user: ReturnType<typeof useCurrentUser>;
  onOpenGlobalSearch: () => void;
  onToggleSearchScope: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
};

function SearchScopeToggle({
  channelName,
  searchScope,
  onToggle,
}: {
  channelName: string;
  searchScope: SearchScope;
  onToggle: () => void;
}) {
  const label =
    searchScope === "everything"
      ? `Search #${channelName}`
      : "Search everything";

  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={label}
        onClick={onToggle}
      >
        <ArrowLeftRight className="size-3.5" />
      </Button>
    </Tooltip>
  );
}

function ChannelSearch({
  channelSearch,
  onToggleScope,
}: {
  channelSearch: ChannelSearchControl;
  onToggleScope: () => void;
}) {
  return (
    <div className="hidden h-9 w-80 items-center rounded-full bg-surface-2 px-1.5 text-sm text-muted-foreground shadow-surface-1 focus-within:ring-1 focus-within:ring-[#6B97FF] lg:flex">
      <label className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
        <Search className="size-4 shrink-0" />
        <span className="sr-only">Search #{channelSearch.channelName}</span>
        <input
          value={channelSearch.value}
          onChange={(event) => channelSearch.onValueChange(event.target.value)}
          placeholder={`Search #${channelSearch.channelName}`}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm pointer-coarse:text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <span className="mx-1 h-4 w-px shrink-0 bg-border/70" aria-hidden />
      <SearchScopeToggle
        channelName={channelSearch.channelName}
        searchScope="channel"
        onToggle={onToggleScope}
      />
    </div>
  );
}

function GlobalSearch({
  channelSearch,
  commandHint,
  onOpen,
  onToggleScope,
}: {
  channelSearch?: ChannelSearchControl;
  commandHint: boolean;
  onOpen: () => void;
  onToggleScope: () => void;
}) {
  return (
    <div className="hidden items-center gap-1 lg:flex">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-80 justify-start rounded-full pl-4 pr-3 text-left text-muted-foreground hover:text-foreground [&>span]:w-full [&>span>span]:w-full"
        onClick={onOpen}
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1">Search everything</span>
        <KbdGroup className="shrink-0">
          {commandHint ? <Kbd>⌘</Kbd> : <Kbd>Ctrl</Kbd>}
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      {channelSearch ? (
        <SearchScopeToggle
          channelName={channelSearch.channelName}
          searchScope="everything"
          onToggle={onToggleScope}
        />
      ) : null}
    </div>
  );
}

function AppShellHeader({
  headerSlot,
  channelSearch,
  searchScope,
  commandHint,
  user,
  onOpenGlobalSearch,
  onToggleSearchScope,
  onOpenProfile,
  onLogout,
}: AppShellHeaderProps) {
  const doNotDisturb = useDoNotDisturbMenu();

  return (
    <header className={`app-main-header sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 border-b bg-card px-4 pt-[env(safe-area-inset-top)] md:px-6 lg:px-8 ${CARD_SURFACE_FOREGROUND}`}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {headerSlot ?? <div className="min-w-0 flex-1" />}
      </div>

      {channelSearch && searchScope === "channel" ? (
        <ChannelSearch
          channelSearch={channelSearch}
          onToggleScope={onToggleSearchScope}
        />
      ) : (
        <GlobalSearch
          channelSearch={channelSearch}
          commandHint={commandHint}
          onOpen={onOpenGlobalSearch}
          onToggleScope={onToggleSearchScope}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="shrink-0 lg:hidden"
        aria-label="Search"
        onClick={onOpenGlobalSearch}
      >
        <Search />
      </Button>

      {user ? (
        <DropdownMenu>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                className="shrink-0 rounded-full p-0 hover:bg-transparent active:bg-transparent sm:h-9 sm:w-auto sm:min-w-11 sm:px-0 sm:pr-3"
              >
                <PresenceAvatar status={doNotDisturb.doNotDisturb ? "doNotDisturb" : undefined}>
                  <UserAvatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    preferredName={user.preferredName}
                    avatarUrl={user.avatarUrl}
                    className="size-11 sm:size-9"
                    fallbackClassName="text-xs"
                  />
                </PresenceAvatar>
                <span className="hidden truncate pl-1 sm:inline">
                  {displayName(user)}
                </span>
                <ChevronDown
                  aria-hidden
                  className="hidden size-4 text-muted-foreground sm:block"
                />
              </Button>
            }
          />
          <DropdownContent align="end" className="w-64">
            <MenuItem
              icon={Settings}
              label="Settings"
              index={0}
              onSelect={onOpenProfile}
            />
            {doNotDisturb.actions.map((action, index) => (
              <MenuItem
                key={action.key}
                icon={action.icon}
                label={action.label}
                index={index + 1}
                onSelect={action.onSelect}
              />
            ))}
            <MenuItem
              icon={LogOut}
              label="Sign out"
              index={doNotDisturb.actions.length + 1}
              onSelect={onLogout}
              className="hover:[&_svg]:text-red-500"
            />
          </DropdownContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}

export { AppShellHeader };

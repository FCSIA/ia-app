import { displayName } from "~/apps/shared/user-name";
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
import { cn } from "@/lib/utils";

export type ChannelSearchControl = {
  channelName: string;
  value: string;
  onValueChange: (value: string) => void;
};

export type SearchScope = "everything" | "channel";

type AppShellHeaderProps = {
  headerSlot?: ReactNode;
  mode?: "default" | "editing";
  globalSearchInSidebar?: boolean;
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
    <div className="hidden h-9 w-80 items-center rounded-full bg-surface-2 px-1.5 text-sm text-muted-foreground shadow-surface-1 focus-within:ring-1 focus-within:ring-ring lg:flex">
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
  mode = "default",
  globalSearchInSidebar = false,
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
    <header
      data-mode={mode}
      className={cn(
        "app-main-header sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] md:h-[calc(4rem+env(safe-area-inset-top))] md:gap-3 md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]",
        CARD_SURFACE_FOREGROUND,
        mode === "editing" ? "bg-primary/20" : "bg-card",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {headerSlot ?? <div className="min-w-0 flex-1" />}
      </div>

      {mode !== "editing" &&
        (channelSearch && searchScope === "channel" ? (
          <ChannelSearch
            channelSearch={channelSearch}
            onToggleScope={onToggleSearchScope}
          />
        ) : !globalSearchInSidebar || channelSearch ? (
          <GlobalSearch
            channelSearch={channelSearch}
            commandHint={commandHint}
            onOpen={onOpenGlobalSearch}
            onToggleScope={onToggleSearchScope}
          />
        ) : null)}

      {mode !== "editing" ? (
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
      ) : null}

      {mode !== "editing" && user ? (
        <DropdownMenu>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="md"
                trailingIcon={ChevronDown}
                aria-label={`${displayName(user)} account menu`}
                className="h-11 shrink-0 rounded-full p-0 hover:bg-transparent active:bg-transparent sm:h-9 sm:min-w-11 sm:pr-3"
              >
                <PresenceAvatar
                  status={
                    doNotDisturb.doNotDisturb ? "doNotDisturb" : undefined
                  }
                >
                  <UserAvatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    preferredName={user.preferredName}
                    avatarUrl={user.avatarUrl}
                    className="size-9"
                    fallbackClassName="text-xs"
                  />
                </PresenceAvatar>
                <span className="hidden truncate pl-1 sm:inline">
                  {displayName(user)}
                </span>
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

"use client";

import { displayName } from "~/apps/shared/user-name";
import { Search, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputControl,
  InputControlAddon,
  InputControlButton,
  InputControlInput,
} from "@/components/ui/input-control-group";
import { Spinner } from "@/components/ui/spinner";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";

/** Classmate search with inline add/accept actions. */
export function FriendSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const {
    acceptFriendRequest,
    deferredSearch,
    isSearching,
    normalizedDeferredSearch,
    pendingAction,
    runScheduleAction,
    search,
    searchIsDeferred,
    searchResults,
    sendFriendRequest,
    setSearch,
  } = useScheduleWorkspace();

  return (
    <div className="flex flex-col gap-2">
      <InputControl>
        <InputControlAddon>
          <Search aria-hidden="true" />
        </InputControlAddon>
        <InputControlInput
          autoFocus={autoFocus}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search students"
          aria-label="Search students"
        />
        <InputControlAddon align="inline-end">
          {isSearching || searchIsDeferred ? (
            <Spinner />
          ) : search ? (
            <InputControlButton
              size="icon-compact"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X />
            </InputControlButton>
          ) : null}
        </InputControlAddon>
      </InputControl>

      {deferredSearch.trim().length < 2 ? null : searchResults.length > 0 ? (
        <div className="divide-y divide-border/40">
          {searchResults.map((person) => {
            const sendKey = `friend-send:${person._id}`;
            const acceptKey = `friend-accept:${person._id}`;
            const status = person.friendshipStatus;
            return (
              <div
                key={person._id}
                className="flex min-h-11 items-center justify-between gap-3 py-1.5"
              >
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {displayName(person)}
                </p>
                {status === "FRIENDS" ? (
                  <Badge size="sm" color="green">
                    Friend
                  </Badge>
                ) : status === "REQUEST_SENT" ? (
                  <Badge size="sm">Pending</Badge>
                ) : status === "REQUEST_RECEIVED" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pendingAction === acceptKey}
                    onClick={() =>
                      void runScheduleAction(
                        acceptKey,
                        () => acceptFriendRequest({ requesterId: person._id }),
                        "Friend added",
                      )
                    }
                  >
                    Accept
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    leadingIcon={UserPlus}
                    loading={pendingAction === sendKey}
                    onClick={() =>
                      void runScheduleAction(
                        sendKey,
                        () => sendFriendRequest({ friendId: person._id }),
                        "Request sent",
                      )
                    }
                  >
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-2 text-xs text-muted-foreground">
          No results for &ldquo;{normalizedDeferredSearch}&rdquo;
        </p>
      )}
    </div>
  );
}

"use client";

import { Search, UserPlus, UsersRound, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FriendScheduleCard } from "@/components/schedule/friend-schedule-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputControl,
  InputControlAddon,
  InputControlButton,
  InputControlInput,
} from "@/components/ui/input-control-group";
import { Spinner } from "@/components/ui/spinner";
import { TabPanel } from "@/components/ui/tabs";
import { useScheduleWorkspace } from "./ScheduleWorkspaceProvider";
import { FriendCollaborationTools } from "./FriendCollaborationTools";

export function FriendSchedulesPanel() {
  const searchParams = useSearchParams();
  const focusedFriendId = searchParams?.get("friend") ?? null;
  const {
    acceptFriendRequest,
    blocks,
    data,
    deferredSearch,
    incomingRequestsRef,
    isSearching,
    normalizedDeferredSearch,
    pendingAction,
    removeFriend,
    runScheduleAction,
    search,
    searchIsDeferred,
    searchResults,
    sendFriendRequest,
    setSearch,
  } = useScheduleWorkspace();

  return (
    <TabPanel value="friends" className="mt-5">
      <div className="flex flex-col gap-5">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          <aside className="flex flex-col gap-4 rounded-xl bg-surface-2 p-3 shadow-surface-1 lg:sticky lg:top-4">
            <div className="flex flex-col gap-1 px-1">
              <h2 className="text-sm font-semibold text-foreground">
                Find classmates
              </h2>
            </div>
            <InputControl>
              <InputControlAddon>
                <Search aria-hidden="true" />
              </InputControlAddon>
              <InputControlInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students"
              />
              <InputControlAddon align="inline-end">
                {isSearching || searchIsDeferred ? (
                  <Spinner />
                ) : search ? (
                  <InputControlButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X />
                  </InputControlButton>
                ) : null}
              </InputControlAddon>
            </InputControl>

            {deferredSearch.trim().length < 2 ? null : searchResults.length >
              0 ? (
              <div className="divide-y divide-border/40 overflow-hidden rounded-lg bg-surface-3 px-2">
                {searchResults.map((person) => {
                  const sendKey = `friend-send:${person._id}`;
                  const acceptKey = `friend-accept:${person._id}`;
                  const isSending = pendingAction === sendKey;
                  const isAccepting = pendingAction === acceptKey;
                  const status = person.friendshipStatus;
                  return (
                    <div
                      key={person._id}
                      className="flex min-h-11 items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {person.firstName} {person.lastName}
                        </p>
                      </div>
                      {status === "FRIENDS" ? (
                        <Badge size="sm" variant="solid" color="green">
                          Friend
                        </Badge>
                      ) : status === "REQUEST_SENT" ? (
                        <Badge size="sm" variant="solid">
                          Pending
                        </Badge>
                      ) : status === "REQUEST_RECEIVED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={isAccepting}
                          disabled={isAccepting}
                          onClick={() =>
                            void runScheduleAction(
                              acceptKey,
                              () =>
                                acceptFriendRequest({
                                  requesterId: person._id,
                                }),
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
                          loading={isSending}
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
              <p className="py-3 text-xs text-muted-foreground">
                No results for &ldquo;{normalizedDeferredSearch}&rdquo;
              </p>
            )}

            {data?.incomingRequests?.length ? (
              <div
                ref={incomingRequestsRef}
                className="flex flex-col gap-2 border-t border-border/50 pt-3"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Requests · {data.incomingRequests.length}
                </p>
                {data.incomingRequests.map((request) => {
                  const acceptKey = `friend-accept:${request.user._id}`;
                  const removeKey = `friend-remove:${request.user._id}`;
                  const isAccepting = pendingAction === acceptKey;
                  const isDeclining = pendingAction === removeKey;
                  return (
                    <div
                      key={request.id}
                      className="flex min-h-10 items-center gap-2 py-1"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {request.user.firstName} {request.user.lastName}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Decline ${request.user.firstName}'s request`}
                          disabled={isDeclining || isAccepting}
                          onClick={() =>
                            void runScheduleAction(
                              removeKey,
                              () =>
                                removeFriend({ otherUserId: request.user._id }),
                              "Removed",
                            )
                          }
                        >
                          <X />
                        </Button>
                        <Button
                          size="md"
                          loading={isAccepting}
                          disabled={isDeclining}
                          onClick={() =>
                            void runScheduleAction(
                              acceptKey,
                              () =>
                                acceptFriendRequest({
                                  requesterId: request.user._id,
                                }),
                              "Friend added",
                            )
                          }
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </aside>

          <section className="flex min-w-0 flex-col gap-3">
            <header className="flex min-h-9 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  Friend schedules
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {data?.friends.length ? (
                  <Badge size="sm">{data.friends.length}</Badge>
                ) : null}
                <FriendCollaborationTools />
              </div>
            </header>
            {data?.friends.length ? (
              <div className="flex flex-col gap-2">
                {[...data.friends]
                  .sort((left, right) =>
                    left.user._id === focusedFriendId
                      ? -1
                      : right.user._id === focusedFriendId
                        ? 1
                        : 0,
                  )
                  .map((friend) => (
                    <FriendScheduleCard
                      key={friend.id}
                      friend={friend}
                      blocks={blocks}
                      day={data.resolvedDay}
                      onRemove={() =>
                        void runScheduleAction(
                          `friend-remove:${friend.user._id}`,
                          () => removeFriend({ otherUserId: friend.user._id }),
                          "Removed",
                        )
                      }
                      isRemoving={
                        pendingAction === `friend-remove:${friend.user._id}`
                      }
                      emphasized={friend.user._id === focusedFriendId}
                    />
                  ))}
              </div>
            ) : (
              <Empty className="min-h-72 bg-surface-2 shadow-surface-1">
                <EmptyHeader>
                  <EmptyMedia>
                    <UsersRound className="size-6 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle>No friends here yet</EmptyTitle>
                  <EmptyDescription>
                    Search for a classmate or share a friend link to compare
                    schedules.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        </div>
      </div>
    </TabPanel>
  );
}

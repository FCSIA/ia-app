'use client';

import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { FriendScheduleCard } from '@/components/schedule/friend-schedule-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabPanel } from '@/components/ui/tabs';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function FriendSchedulesPanel() {
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
    <TabPanel value="friends" className="mt-6">
      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 rounded-lg border-0 bg-muted/30 pl-9 pr-9 text-sm shadow-none focus-visible:ring-1"
              placeholder="Search students..."
            />
            {isSearching || searchIsDeferred ? (
              <Loader2 className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {deferredSearch.trim().length < 2 ? null : searchResults.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-hidden">
              {searchResults.map((person) => {
                const sendKey = `friend-send:${person._id}`;
                const acceptKey = `friend-accept:${person._id}`;
                const isSending = pendingAction === sendKey;
                const isAccepting = pendingAction === acceptKey;
                const status = person.friendshipStatus;
                return (
                  <div key={person._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {person.firstName} {person.lastName}
                      </p>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {person.uniqueId}
                      </span>
                    </div>
                    {status === 'FRIENDS' ? (
                      <span className="text-[10px] text-muted-foreground">Added</span>
                    ) : status === 'REQUEST_SENT' ? (
                      <span className="text-[10px] text-muted-foreground">Pending</span>
                    ) : status === 'REQUEST_RECEIVED' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 px-2 text-[10px]"
                        disabled={isAccepting}
                        onClick={() =>
                          void runScheduleAction(
                            acceptKey,
                            () => acceptFriendRequest({ requesterId: person._id }),
                            'Friend added',
                          )
                        }
                      >
                        Accept
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px]"
                        disabled={isSending}
                        onClick={() =>
                          void runScheduleAction(
                            sendKey,
                            () => sendFriendRequest({ friendId: person._id }),
                            'Request sent',
                          )
                        }
                      >
                        <UserPlus className="mr-1 size-2.5" />
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
            <div ref={incomingRequestsRef} className="flex flex-col gap-2 border-t border-border/30 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Requests · {data.incomingRequests.length}
              </p>
              {data.incomingRequests.map((request) => {
                const acceptKey = `friend-accept:${request.user._id}`;
                const removeKey = `friend-remove:${request.user._id}`;
                const isAccepting = pendingAction === acceptKey;
                const isDeclining = pendingAction === removeKey;
                return (
                  <div key={request.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="truncate text-sm text-foreground">
                      {request.user.firstName} {request.user.lastName}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        disabled={isDeclining || isAccepting}
                        onClick={() =>
                          void runScheduleAction(
                            removeKey,
                            () => removeFriend({ otherUserId: request.user._id }),
                            'Removed',
                          )
                        }
                      >
                        <X className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        disabled={isAccepting || isDeclining}
                        onClick={() =>
                          void runScheduleAction(
                            acceptKey,
                            () => acceptFriendRequest({ requesterId: request.user._id }),
                            'Friend added',
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
        </div>

        <div className="flex flex-col gap-3">
          {data?.friends.length ? (
            <div className="flex flex-col gap-2">
              {data.friends.map((friend) => (
                <FriendScheduleCard
                  key={friend.id}
                  friend={friend}
                  blocks={blocks}
                  onRemove={() =>
                    void runScheduleAction(
                      `friend-remove:${friend.user._id}`,
                      () => removeFriend({ otherUserId: friend.user._id }),
                      'Removed',
                    )
                  }
                  isRemoving={pendingAction === `friend-remove:${friend.user._id}`}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Search and add friends to compare schedules.
            </p>
          )}
        </div>
      </div>
    </TabPanel>
  );
}

'use client';

import { displayName } from '~/apps/shared/user-name';
import { useDeferredValue, useState } from 'react';
import { formatMessageTime } from '@/lib/message-time';
import { useAppFrameActions } from '@/components/layout/app-frame-context';
import { useQuery } from '@/lib/convex-react';
import { Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MAX_CHANNEL_SEARCH_RESULTS } from '~/apps/shared/chat/protocol';

export function ChannelSearch({
  clubId,
  channelId,
  channelName,
  onJump,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  channelName: string;
  onJump: (
    messageId: Id<'clubChannelMessages'>,
    threadId?: Id<'clubChannelMessages'>,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
  const { openGlobalSearch } = useAppFrameActions();
  const results = useQuery(
    api.clubs.channels.searchMessages,
    open && query.length >= 2 ? { clubId, channelId, search: query } : 'skip',
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={`Search #${channelName}`}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Search #${channelName}`}
          >
            <Search />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      {/* Opens toward the conversation: the trigger now follows the channel name. */}
      <PopoverContent
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] p-2"
      >
        <Input
          aria-label={`Search messages in #${channelName}`}
          placeholder={`Search #${channelName}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto pt-2" aria-live="polite">
          {query.length === 0 ? null : query.length < 2 ? (
            <p className="p-2 text-sm text-muted-foreground">
              Type at least two characters.
            </p>
          ) : results === undefined ? (
            <Skeleton className="h-16 w-full" />
          ) : results.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              No messages in #{channelName} match “{query}”.
            </p>
          ) : (
            <>
              <p className="px-2 pb-1 text-xs text-muted-foreground">
                {results.length}
                {results.length === MAX_CHANNEL_SEARCH_RESULTS ? '+' : ''}{' '}
                {results.length === 1 ? 'result' : 'results'}
              </p>
              {results.map((message) => (
                <button
                  key={message._id}
                  className="flex w-full gap-2 rounded-lg p-2 text-left hover:bg-hover focus-visible:bg-hover"
                  onClick={() => {
                    setOpen(false);
                    onJump(
                      message._id,
                      message.parentMessageId
                        ? message.threadRootId
                        : undefined,
                    );
                  }}
                >
                  <UserAvatar
                    person={message.author}
                    className="size-7"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {displayName(message.author)} ·{' '}
                      {formatMessageTime(message.createdAt)}
                    </span>
                    {/* Inside typeset so <mark> uses the shared highlight,
                        not the browser's yellow-on-black default. */}
                    <span className="typeset typeset-chat line-clamp-2 whitespace-pre-wrap break-words">
                      {message.body
                        .split(
                          new RegExp(
                            `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                            'gi',
                          ),
                        )
                        .map((part, index) =>
                          part.toLowerCase() === query.toLowerCase() ? (
                            <mark key={index}>{part}</mark>
                          ) : (
                            part
                          ),
                        )}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
        {/* Phones show one search control in a channel; this keeps the
            app-wide search one tap away. */}
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={Search}
          className="mt-1 w-full justify-start text-muted-foreground lg:hidden"
          onClick={() => {
            setOpen(false);
            openGlobalSearch();
          }}
        >
          Search everything
        </Button>
      </PopoverContent>
    </Popover>
  );
}

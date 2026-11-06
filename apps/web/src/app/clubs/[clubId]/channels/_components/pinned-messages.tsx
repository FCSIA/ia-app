'use client';

import { displayName } from '~/apps/shared/user-name';
import { useState } from 'react';
import { formatMessageTime } from '@/lib/message-time';
import { Pin } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Card, CardGroup } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

/** The one-line summary of a pinned message, wherever pins are listed. */
export function pinnedMessagePreview(message: ClubChannelMessage) {
  return (
    message.poll?.question ||
    message.body ||
    message.attachments[0]?.fileName ||
    'Attachment'
  );
}

export function PinnedMessagesButton({
  messages,
  onJump,
  hasMore = false,
}: {
  messages: ClubChannelMessage[];
  onJump: (messageId: Id<'clubChannelMessages'>) => void;
  hasMore?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const jumpToMessage = (messageId: Id<'clubChannelMessages'>) => {
    setOpen(false);
    onJump(messageId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Pinned messages">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            badge={
              messages.length
                ? `${messages.length}${hasMore ? '+' : ''}`
                : undefined
            }
            aria-label={`${messages.length}${hasMore ? '+' : ''} pinned ${messages.length === 1 ? 'message' : 'messages'}`}
          >
            <Pin className="size-4" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Pinned messages</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {messages.length}
          </span>
        </div>
        {messages.length > 0 ? (
          <ScrollArea viewportClassName="max-h-80">
            <CardGroup orientation="inline" corners="compact">
              {messages.map((message) => {
                return (
                  <Card
                    key={message._id}
                    label={`Jump to pinned message by ${displayName(message.author)}`}
                    className="gap-3 px-3 py-3"
                    onClick={() => jumpToMessage(message._id)}
                  >
                    <UserAvatar
                      person={message.author}
                      className="size-7 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">
                          {displayName(message.author)}
                        </span>
                        <DeveloperBadge user={message.author} size={13} />
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">
                        {pinnedMessagePreview(message)}
                      </span>
                    </span>
                  </Card>
                );
              })}
            </CardGroup>
          </ScrollArea>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No pinned messages yet.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { displayName } from '~/apps/shared/user-name';
import { CircleAlert } from 'lucide-react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MentionBody } from './mention-body';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';
import { cn } from '@/lib/utils';
import { WEB_MESSAGE_GROUP_WINDOW_MS } from '~/apps/shared/chat/protocol';
import type { FailedSend, SendingUser } from './use-channel-send';

/**
 * An unsent message keeps its place and anatomy in the conversation: same
 * gutter, same text column, muted body, and the reason with Retry beside it.
 */
function FailedSendRow({
  author,
  grouped,
  payload,
  reason,
  retrying,
  onRetry,
  onDiscard,
}: {
  author: SendingUser;
  grouped: boolean;
  payload: FailedSend['payload'];
  reason: string;
  retrying: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <Message grouped={grouped} className="gap-3 rounded-md px-3">
      <MessageAvatar>
        {grouped ? null : (
          <UserAvatar
            person={author}
            className="size-9"
            fallbackClassName="text-[11px]"
          />
        )}
      </MessageAvatar>
      <MessageContent className="gap-0">
        {grouped ? null : (
          <MessageHeader className="gap-2 px-0 text-[13px]">
            <span className="truncate font-semibold text-foreground">
              {displayName(author)}
            </span>
          </MessageHeader>
        )}
        <div className={cn('min-w-0 max-w-[75ch]', !grouped && 'mt-1')}>
          {payload.body ? (
            <MentionBody
              body={payload.body}
              bodyMarkdown={payload.bodyMarkdown}
              bodyRich={payload.bodyRich}
              className="text-muted-foreground"
            />
          ) : payload.pollQuestion ? (
            <p className="text-sm text-muted-foreground">
              {payload.pollQuestion}
            </p>
          ) : null}
          {payload.files.map((file, index) => (
            <p key={index} className="text-xs text-muted-foreground">
              {file.name}
            </p>
          ))}
        </div>
        <div
          role="alert"
          className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive"
        >
          <span className="flex min-w-0 items-start gap-1">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>Couldn’t send · {reason}</span>
          </span>
          <span className="flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              loading={retrying}
              onClick={onRetry}
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={retrying}
              onClick={onDiscard}
            >
              Discard
            </Button>
          </span>
        </div>
      </MessageContent>
    </Message>
  );
}

/** The unsent messages for one conversation (the channel, or one thread), shown after its delivered messages. */
export function FailedSends({
  failedSends,
  channelId,
  parentMessageId,
  user,
  delivered,
  onRetry,
  onDiscard,
  onRefocus,
}: {
  failedSends: FailedSend[];
  channelId: Id<'clubChannels'>;
  parentMessageId?: Id<'clubChannelMessages'>;
  user: SendingUser & { _id: Id<'users'> };
  delivered: ClubChannelMessage[];
  onRetry: (item: FailedSend) => void;
  onDiscard: (item: FailedSend) => void;
  onRefocus: () => void;
}) {
  const items = failedSends.filter(
    (item) =>
      item.channelId === channelId &&
      item.payload.parentMessageId === parentMessageId,
  );
  if (items.length === 0) return null;
  // The first unsent row joins the viewer's run when the conversation
  // already ends with the viewer's own recent message.
  const last = delivered[delivered.length - 1];
  const joinsRun =
    !!last &&
    last.authorId === user._id &&
    !last.isDeleted &&
    Date.now() - new Date(last.createdAt).getTime() <=
      WEB_MESSAGE_GROUP_WINDOW_MS;
  const author = {
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    avatarUrl: user.avatarUrl ?? null,
  };
  return items.map((item, index) => (
    <FailedSendRow
      key={item.identity.clientGeneratedId}
      author={author}
      grouped={index > 0 || joinsRun}
      payload={item.payload}
      reason={item.reason}
      retrying={item.retrying}
      onRetry={() => {
        // Retry and Discard unmount their own buttons; keep typing where it was.
        onRefocus();
        onRetry(item);
      }}
      onDiscard={() => {
        onRefocus();
        onDiscard(item);
      }}
    />
  ));
}

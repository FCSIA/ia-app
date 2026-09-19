'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { format, isSameDay, isSameYear } from 'date-fns';

function formatChatTimestamp(value: number | string | Date) {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return format(date, 'h:mm a');
  if (isSameYear(date, now)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}
import { useAction, useMutation, usePaginatedQuery, useQuery } from '@/lib/convex-react';
import {
  BarChart3,
  FileText,
  History,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  SmilePlus,
  Trash2,
  AlertTriangle,
  Flag,
  UserPlus,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { AppRole } from '~/apps/convex/lib/roles';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { latestVisibleChatActivity } from '~/apps/shared/chat/activity';
import { dismissReadChannelWebNotifications } from '@/lib/push-notifications';

type ClubChannelMessageAttachment = ClubChannelMessage['attachments'][number];
import {
  ChannelMessageComposer,
  type ChannelMentionSuggestion,
} from '@/components/clubs/channel-message-composer';
import {
  ClubChannelVisibilityIcon,
  getClubChannelVisibilityLabel,
} from '@/components/clubs/channel-visibility';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { UserProfileDialog } from '@/components/clubs/user-profile-dialog';
import {
  MentionBody,
  type ClubChannelMessageRichBody,
} from '@/components/clubs/mention-body';
import { formatClubRole, fullName } from '@/components/clubs/types';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment';
import { Badge } from '@/components/ui/badge';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller';
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery, normalizeSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { useToast } from '@/hooks/use-toast';
import {
  createClientMessageIdentity,
  optimisticallyInsertPostedMessage,
  optimisticallyToggleMessageReaction,
} from '~/apps/shared/chat/optimistic-message';

const QUICK_REACTIONS = [
  { value: 'LIKE', label: '👍', name: 'Like' },
  { value: 'HEART', label: '❤️', name: 'Love' },
  { value: 'FIRE', label: '🔥', name: 'Fire' },
  { value: 'CELEBRATE', label: '🎉', name: 'Celebrate' },
  { value: 'EYES', label: '👀', name: 'Watching' },
  { value: 'DONE', label: '✅', name: 'Done' },
] as const;

const REACTION_LABELS = Object.fromEntries(
  QUICK_REACTIONS.map((reaction) => [reaction.value, reaction.label]),
) as Record<string, string>;

type ChannelReaction = (typeof QUICK_REACTIONS)[number]['value'];
type FriendshipStatus = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';

const MESSAGE_GROUP_WINDOW_MS = 30 * 60 * 1000;

function isChannelReaction(value: string): value is ChannelReaction {
  return QUICK_REACTIONS.some((reaction) => reaction.value === value);
}

function shouldGroupMessages(
  previous: ClubChannelMessage | undefined,
  current: ClubChannelMessage,
) {
  if (!previous || previous.author._id !== current.author._id) return false;
  if (previous.isPinned || current.isPinned) return false;
  if ('deliveryState' in previous || 'deliveryState' in current) return false;

  const previousDate = new Date(previous.createdAt);
  const currentDate = new Date(current.createdAt);
  if (!isSameDay(previousDate, currentDate)) return false;

  const elapsed = currentDate.getTime() - previousDate.getTime();
  return elapsed >= 0 && elapsed <= MESSAGE_GROUP_WINDOW_MS;
}

const STUDENT_SCHEDULE_ROLES = new Set<AppRole>([
  'STUDENT',
  'STUDENT_LEADER',
  'STUDENT_ADMIN',
]);

type ComposerSubmitArgs = {
  body: string;
  bodyMarkdown: string;
  bodyRich: ClubChannelMessageRichBody | null;
  parentMessageId?: string;
  replyToMessageId?: string;
  files: File[];
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; label: string }>;
  mode: 'root' | 'thread';
};

function formatBytes(size?: number | null) {
  if (!size) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / (1024 * 102.4)) / 10} MB`;
}

function isImageAttachment(attachment: ClubChannelMessageAttachment) {
  if (attachment.mimeType?.toLowerCase() === 'image/svg+xml') return false;
  return (
    attachment.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(attachment.fileName)
  );
}

function getSearchableText(message: ClubChannelMessage) {
  return [
    message.body,
    fullName(message.author),
    message.author.uniqueId,
    ...message.attachments.map((a) => a.fileName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasStudentScheduleRole(roles?: AppRole[] | null) {
  return roles?.some((role) => STUDENT_SCHEDULE_ROLES.has(role)) ?? false;
}

function getAttachmentDescription(attachment: ClubChannelMessageAttachment) {
  const extension = attachment.fileName.split('.').pop()?.trim().toUpperCase();
  return [
    extension || (isImageAttachment(attachment) ? 'Image' : 'File'),
    formatBytes(attachment.size),
  ]
    .filter(Boolean)
    .join(' · ');
}

function MessageAttachments({ attachments }: { attachments: ClubChannelMessageAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <AttachmentGroup
      className="mt-2 max-w-full gap-2 py-0"
      style={{ WebkitMaskImage: 'none', maskImage: 'none' }}
    >
      {attachments.map((attachment) => {
        const href = attachment.fileUrl;
        const isImage = isImageAttachment(attachment);

        return (
          <Attachment
            key={attachment._id}
            size="sm"
            orientation={isImage ? 'vertical' : 'horizontal'}
            className={cn(
              isImage
                ? 'w-fit! max-w-[85vw] sm:max-w-[min(100%,42rem)] has-data-[slot=attachment-content]:w-full'
                : 'max-w-72',
            )}
          >
            {isImage ? (
              <div className="max-h-[min(60vh,32rem)] max-w-full overflow-hidden rounded-t-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={href}
                  alt={attachment.fileName}
                  className="block h-auto max-h-[min(60vh,32rem)] w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <AttachmentMedia>
                <FileText />
              </AttachmentMedia>
            )}
            <AttachmentContent>
              <AttachmentTitle>{attachment.fileName}</AttachmentTitle>
              <AttachmentDescription>
                {getAttachmentDescription(attachment)}
              </AttachmentDescription>
            </AttachmentContent>
            <AttachmentTrigger asChild aria-label={`Open ${attachment.fileName} in a new tab`}>
              <a href={href} target="_blank" rel="noreferrer" />
            </AttachmentTrigger>
          </Attachment>
        );
      })}
    </AttachmentGroup>
  );
}

function MessageBody({ message }: { message: ClubChannelMessage }) {
  return (
    <MentionBody
      body={message.body}
      bodyMarkdown={message.bodyMarkdown}
      bodyRich={
        Array.isArray(message.bodyRich)
          ? (message.bodyRich as ClubChannelMessageRichBody)
          : null
      }
      className="!text-[13px] !leading-normal"
    />
  );
}

function PinnedMessagesButton({
  messages,
  onClearSearch,
}: {
  messages: ClubChannelMessage[];
  onClearSearch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { scrollToMessage } = useMessageScroller();

  const jumpToMessage = (messageId: string) => {
    onClearSearch();
    setOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToMessage(messageId, { align: 'center', behavior: 'smooth' });
      });
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Pinned messages">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={`${messages.length} pinned ${messages.length === 1 ? 'message' : 'messages'}`}
          >
            <Pin className="size-4" />
            {messages.length > 0 ? (
              <span className="absolute right-0 top-0 flex min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold leading-[14px] text-primary-foreground">
                {messages.length > 9 ? '9+' : messages.length}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Pinned messages</p>
          <span className="text-xs tabular-nums text-muted-foreground">{messages.length}</span>
        </div>
        {messages.length > 0 ? (
          <ScrollArea
            viewportClassName="max-h-80"
          >
            <div className="divide-y divide-border/70">
              {messages.map((message) => {
                const preview =
                  message.poll?.question ||
                  message.body ||
                  message.attachments[0]?.fileName ||
                  'Attachment';
                return (
                  <button
                    key={message._id}
                    type="button"
                    className="flex w-full gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-hover focus-visible:bg-hover"
                    onClick={() => jumpToMessage(message._id)}
                  >
                    <Pin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">
                          {fullName(message.author)}
                        </span>
                        <DeveloperBadge user={message.author} size={13} />
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatChatTimestamp(message.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm leading-5 text-muted-foreground">
                        {preview}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
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

function MessageAuthorPreview({
  author,
  compact,
  currentUserId,
  canSendFriendRequest,
  friendshipStatus,
  friendRequestPendingId,
  onSendFriendRequest,
}: {
  author: ClubChannelMessage['author'];
  compact: boolean;
  currentUserId?: string;
  canSendFriendRequest: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestPendingId?: string | null;
  onSendFriendRequest: (userId: string) => void;
}) {
  const name = fullName(author);
  const isCurrentUser = author._id === currentUserId;
  const isStudentProfile = hasStudentScheduleRole(author.roles);
  const roleLabels = author.roles?.slice(0, 3).map((role) => formatClubRole(role) ?? role) ?? [];
  const isPending = friendRequestPendingId === author._id;
  const canOfferFriendRequest =
    canSendFriendRequest &&
    !isCurrentUser &&
    isStudentProfile &&
    friendshipStatus === 'NONE';
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={`View ${name} profile`}
            className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            onClick={() => setProfileOpen(true)}
          >
            <ClubAvatar
              person={author}
              className={compact ? 'size-7' : 'size-9'}
              fallbackClassName={compact ? 'text-[10px]' : 'text-[11px]'}
            />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="w-64 rounded-lg p-3"
        >
          <div className="flex items-start gap-3">
            <ClubAvatar person={author} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
                <span className="truncate">{name}</span>
                <DeveloperBadge user={author} size={13} />
              </p>
              {roleLabels.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {roleLabels.map((role) => (
                    <Badge key={role} variant="solid" className="h-5 text-[10px]">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {isCurrentUser ? 'This is you' : isStudentProfile ? 'Student IA profile' : 'Public IA profile'}
            </span>
            {canOfferFriendRequest ? (
              <Button
                type="button"
                size="sm"
                variant="tertiary"
                leadingIcon={UserPlus}
                disabled={isPending}
                loading={isPending}
                onClick={() => onSendFriendRequest(author._id)}
              >
                Add friend
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground [@media(pointer:coarse)]:block hidden">
            Tap avatar again for full profile
          </p>
        </HoverCardContent>
      </HoverCard>
      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        person={author}
        isCurrentUser={isCurrentUser}
        canSendFriendRequest={canSendFriendRequest}
        friendshipStatus={friendshipStatus}
        friendRequestPending={isPending}
        onSendFriendRequest={onSendFriendRequest}
      />
    </>
  );
}

function PollCard({
  message,
  onVote,
  isPending,
}: {
  message: ClubChannelMessage;
  onVote: (messageId: string, optionId: string) => void;
  isPending: boolean;
}) {
  if (!message.poll) return null;
  const total = Math.max(message.poll.totalVotes, 1);
  return (
    <div className="mt-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="size-4 text-primary" />
        {message.poll.question}
      </div>
      <div className="mt-3 space-y-2">
        {message.poll.options.map((option) => {
          const percent = Math.round((option.count / total) * 100);
          return (
            <button
              key={option.id}
              type="button"
              disabled={isPending}
              onClick={() => onVote(message._id, option.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-hover',
                option.votedByCurrentUser && 'border-primary/50 bg-primary/10',
              )}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center justify-between gap-3">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.count} · {percent}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReactionButton({
  clubId,
  channelId,
  messageId,
  reaction,
  onToggleReaction,
  isReactionPending,
  openDetailsOnPress,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  messageId: string;
  reaction: ClubChannelMessage['reactions'][number];
  onToggleReaction: (messageId: string, emoji: ChannelReaction) => void;
  isReactionPending: boolean;
  openDetailsOnPress: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reactionLabel = REACTION_LABELS[reaction.emoji] ?? reaction.emoji;
  const reactionName =
    QUICK_REACTIONS.find((candidate) => candidate.value === reaction.emoji)?.name ??
    'Reaction';
  const reactionCountLabel = `${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}`;
  const supportedReaction = isChannelReaction(reaction.emoji) ? reaction.emoji : null;
  const { results: reactors, status, loadMore } = usePaginatedQuery(
    api.clubs.channels.listReactionUsers,
    open
      ? {
          clubId,
          channelId,
          messageId: messageId as Id<'clubChannelMessages'>,
          emoji: reaction.emoji,
        }
      : 'skip',
    { initialNumItems: 25 },
  );

  const trigger = (
    <Button
      variant="tertiary"
      size="sm"
      className={cn(
        '!h-6 !min-h-6 gap-1 rounded-full px-2 py-0 text-xs shadow-none',
        reaction.reactedByCurrentUser && 'border-primary/40 bg-primary/10',
      )}
      disabled={isReactionPending}
      aria-label={
        openDetailsOnPress
          ? `View ${reactionName.toLowerCase()} reactions, ${reactionCountLabel}`
          : `${reactionName} reaction, ${reactionCountLabel}${
              supportedReaction
                ? reaction.reactedByCurrentUser
                  ? ', click to remove yours'
                  : ', click to add yours'
                : ''
            }`
      }
      onClick={
        !openDetailsOnPress && supportedReaction
          ? () => onToggleReaction(messageId, supportedReaction)
          : undefined
      }
    >
      <span>{reactionLabel}</span>
      {reaction.count}
    </Button>
  );

  const details = (
    <>
      {openDetailsOnPress ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-compact"
          className="absolute right-2 top-2 !size-7 !min-h-7"
          aria-label="Close reaction details"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      ) : null}
      <p className={cn('text-sm font-semibold text-foreground', openDetailsOnPress && 'pr-8')}>
        {reactionLabel} reactions
      </p>
      <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
        {status === 'LoadingFirstPage' ? (
          <p className="text-sm text-muted-foreground">Loading people…</p>
        ) : reactors.length > 0 ? (
          reactors.map((reactor) => (
            <p key={reactor._id} className="truncate text-sm text-foreground">
              {fullName(reactor)}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No reactions yet.</p>
        )}
      </div>
      {status === 'CanLoadMore' ? (
        <Button type="button" size="sm" variant="ghost" className="mt-2 w-full" onClick={() => loadMore(50)}>
          Show more
        </Button>
      ) : null}
      {openDetailsOnPress && supportedReaction ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          className="mt-2 w-full"
          disabled={isReactionPending}
          onClick={() => {
            onToggleReaction(messageId, supportedReaction);
            setOpen(false);
          }}
        >
          {reaction.reactedByCurrentUser ? 'Remove your reaction' : 'Add reaction'}
        </Button>
      ) : null}
    </>
  );

  if (openDetailsOnPress) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          collisionPadding={12}
          className="w-64 rounded-lg p-3"
          aria-label={`${reactionName} reactions`}
        >
          {details}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-64 rounded-lg p-3"
      >
        {details}
      </HoverCardContent>
    </HoverCard>
  );
}

function ScrollToReplyTarget({
  messageId,
  requestKey,
  targetPresent,
}: {
  messageId: string | null;
  requestKey: number;
  targetPresent: boolean;
}) {
  const { scrollToMessage } = useMessageScroller();
  const lastScrolledRequestKey = useRef<number | null>(null);

  useEffect(() => {
    if (!messageId || !targetPresent || lastScrolledRequestKey.current === requestKey) return;

    const frame = requestAnimationFrame(() => {
      if (scrollToMessage(messageId, { align: 'center', behavior: 'smooth' })) {
        lastScrolledRequestKey.current = requestKey;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messageId, requestKey, scrollToMessage, targetPresent]);

  return null;
}

function MessageRow({
  clubId,
  message,
  replyTarget,
  onStartReply,
  onJumpToReply,
  onOpenThread,
  onToggleReaction,
  onTogglePin,
  onVotePoll,
  onStartEdit,
  onDelete,
  onShowHistory,
  onReport,
  canSendFriendRequest,
  friendshipStatus,
  onSendFriendRequest,
  isEditing,
  isReactionPending,
  isPinPending,
  isVotePending,
  isDeletePending,
  friendRequestPendingId,
  highlighted,
  jumpedTo,
  canPinMessages,
  canModerateMessages,
  currentUserId,
  openReactionDetailsOnPress,
  compact = false,
  groupedWithPrevious = false,
}: {
  clubId: Id<'clubs'>;
  message: ClubChannelMessage;
  replyTarget?: ClubChannelMessage;
  onStartReply: (messageId: string) => void;
  onJumpToReply: (messageId: string) => void;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: ChannelReaction) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onStartEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onShowHistory?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  canSendFriendRequest: boolean;
  friendshipStatus?: FriendshipStatus;
  onSendFriendRequest: (userId: string) => void;
  isEditing: boolean;
  isReactionPending: boolean;
  isPinPending: boolean;
  isVotePending: boolean;
  isDeletePending: boolean;
  friendRequestPendingId?: string | null;
  highlighted: boolean;
  jumpedTo: boolean;
  canPinMessages: boolean;
  canModerateMessages: boolean;
  currentUserId?: string;
  openReactionDetailsOnPress: boolean;
  compact?: boolean;
  groupedWithPrevious?: boolean;
}) {
  const isTouchPrimary = useTouchPrimary();
  // Thread replies are always compact; on touch-primary devices every row
  // uses the compact rhythm so more of the conversation fits above the
  // keyboard. Type sizes stay untouched — the win is spacing, not legibility.
  const dense = compact || isTouchPrimary;
  const isAuthor = message.author._id === currentUserId;
  const isDeleted = message.isDeleted;
  const isEdited = !isDeleted && message.updatedAt !== message.createdAt;
  const isSending =
    'deliveryState' in message && message.deliveryState === 'sending';
  const hasBody = message.body.trim().length > 0;
  const hasReactions =
    !isDeleted && !isEditing && !isSending && message.reactions.length > 0;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const replySwipeStart = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const [replySwipeOffset, setReplySwipeOffset] = useState(0);
  const [replySwipeSettling, setReplySwipeSettling] = useState(false);
  const canSwipeToReply = isTouchPrimary && !isDeleted && !isSending && !isEditing;
  // Swipe-to-reply is an enhancement, never the only route: the hover action bar
  // is pointer-only anyway, so touch-primary devices keep Reply in the long-press
  // context menu, which is also what keyboards and assistive tech reach.
  const showReplyActionButton = !compact && !isTouchPrimary;
  const canReply = !compact;

  const resetReplySwipe = () => {
    replySwipeStart.current = null;
    setReplySwipeSettling(true);
    setReplySwipeOffset(0);
    requestAnimationFrame(() => setReplySwipeSettling(false));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={isDeleted || isSending || isEditing}>
        <div className="relative touch-pan-y select-none [-webkit-touch-callout:none]">
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 end-3 flex items-center text-primary transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
              replySwipeOffset ? 'translate-x-0 opacity-100' : 'translate-x-1 opacity-0',
            )}
          >
            <Reply className="size-4" />
          </div>
          <div
            className={cn(
              'relative will-change-transform',
              replySwipeSettling && 'transition-transform duration-200 ease-out motion-reduce:transition-none',
            )}
            style={replySwipeOffset ? { transform: `translateX(${replySwipeOffset}px)` } : undefined}
            onTouchStart={(event) => {
              if (!canSwipeToReply || event.touches.length !== 1) return;
              if ((event.target as HTMLElement).closest('button, a, input, textarea, [contenteditable=true]')) return;
              const touch = event.touches[0];
              replySwipeStart.current = { x: touch.clientX, y: touch.clientY, swiping: false };
            }}
            onTouchMove={(event) => {
              const start = replySwipeStart.current;
              if (!start || event.touches.length !== 1) return;
              const touch = event.touches[0];
              const deltaX = touch.clientX - start.x;
              const deltaY = Math.abs(touch.clientY - start.y);
              if (!start.swiping) {
                if (Math.max(Math.abs(deltaX), deltaY) < 8) return;
                if (deltaX >= 0 || Math.abs(deltaX) < deltaY * 1.25) {
                  replySwipeStart.current = null;
                  return;
                }
                start.swiping = true;
              }
              // Right swipes belong to the workspace navigation gesture. Replies
              // deliberately use the opposite direction so the two never compete.
              event.preventDefault();
              setReplySwipeSettling(false);
              setReplySwipeOffset(Math.max(-48, Math.min(0, deltaX)));
            }}
            onTouchEnd={(event) => {
              const start = replySwipeStart.current;
              const touch = event.changedTouches[0];
              if (start?.swiping && touch && start.x - touch.clientX >= 48) {
                setReplySwipeOffset(-48);
                onStartReply(message._id);
              }
              resetReplySwipe();
            }}
            onTouchCancel={resetReplySwipe}
          >
          <Message
            className={cn(
              'rounded-md gap-3 px-3 transition-colors hover:bg-hover',
              groupedWithPrevious ? 'py-0' : dense ? 'py-1.5' : 'py-2.5',
              jumpedTo && 'bg-primary/10 ring-1 ring-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
              isSending &&
                'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
            )}
          >
      <MessageAvatar className="self-start overflow-visible bg-transparent">
        {!groupedWithPrevious ? (
          <MessageAuthorPreview
            author={message.author}
            compact={dense}
            currentUserId={currentUserId}
            canSendFriendRequest={canSendFriendRequest}
            friendshipStatus={friendshipStatus}
            friendRequestPendingId={friendRequestPendingId}
            onSendFriendRequest={onSendFriendRequest}
          />
        ) : null}
      </MessageAvatar>
      <MessageContent className="gap-0">
        {!groupedWithPrevious ? (
          <MessageHeader className="gap-2 px-0 text-[13px]">
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-foreground">
              {fullName(message.author)}
              <DeveloperBadge user={message.author} size={13} />
            </span>
            <span className="text-xs text-muted-foreground">
              {isSending ? 'Sending…' : formatChatTimestamp(message.createdAt)}
            </span>
            {message.isPinned ? (
              <Badge variant="solid" color="amber" className="h-5 text-[10px]">
                Pinned
              </Badge>
            ) : null}
            {isEdited ? (
              <button
                type="button"
                className="group/history flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                onClick={() => onShowHistory?.(message._id)}
              >
                <History className="size-3" />
                <span>(edited)</span>
              </button>
            ) : null}
          </MessageHeader>
        ) : null}

        {isEditing ? (
          <div className="mt-2" />
        ) : (
          <Bubble
            variant="ghost"
            align="start"
            className={cn(!groupedWithPrevious && 'mt-1')}
          >
            {message.replyToMessageId ? (
              <button
                type="button"
                className="mb-1 flex min-w-0 items-baseline gap-1.5 border-l-2 border-border pl-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => onJumpToReply(message.replyToMessageId!)}
              >
                <span className="shrink-0 font-medium text-foreground">
                  {replyTarget ? fullName(replyTarget.author) : 'Earlier message'}
                </span>
                <span className="truncate">
                  {replyTarget
                    ? replyTarget.isDeleted
                      ? 'Message deleted'
                      : replyTarget.body || 'Attachment'
                    : 'Message unavailable'}
                </span>
              </button>
            ) : null}
            {isDeleted || hasBody ? (
              <BubbleContent
                className={cn(
                  'text-[13px] leading-normal',
                  highlighted && 'rounded-md bg-primary/10 px-1.5 py-0.5 ring-1 ring-primary/25',
                )}
              >
                {isDeleted ? (
                  <p className="text-[13px] italic text-muted-foreground">Message deleted</p>
                ) : (
                  <MessageBody message={message} />
                )}
              </BubbleContent>
            ) : null}
            {!isDeleted ? (
              <>
                <PollCard message={message} onVote={onVotePoll} isPending={isVotePending} />
                <MessageAttachments attachments={message.attachments} />
              </>
            ) : null}
            {hasReactions ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {message.reactions.map((reaction) => (
                  <ReactionButton
                    key={`${message._id}-${reaction.emoji}`}
                    clubId={clubId}
                    channelId={message.channelId}
                    messageId={message._id}
                    reaction={reaction}
                    onToggleReaction={onToggleReaction}
                    isReactionPending={isReactionPending}
                    openDetailsOnPress={openReactionDetailsOnPress}
                  />
                ))}
              </div>
            ) : null}
          </Bubble>
        )}

        {!isEditing && (
          <>
            {!isDeleted && !isSending ? (
              <>
                <MessageActions
                  className={cn(
                    'translate-y-1 rounded-lg border bg-popover p-0.5 opacity-0 shadow-md transition-[opacity,transform] duration-150 motion-reduce:transition-none group-hover/message:translate-y-0 group-hover/message:opacity-100 group-focus-within/message:translate-y-0 group-focus-within/message:opacity-100',
                    (reactionPickerOpen || actionsMenuOpen || deleteDialogOpen) &&
                      'translate-y-0 opacity-100',
                  )}
                >
                  <Popover open={reactionPickerOpen} onOpenChange={setReactionPickerOpen}>
                    <Tooltip content="Add reaction">
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          disabled={isReactionPending}
                          aria-label="Add reaction"
                        >
                          <SmilePlus className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </Tooltip>
                    <PopoverContent
                      side="top"
                      align="end"
                      className="flex w-auto gap-0.5 rounded-lg p-1"
                    >
                      {QUICK_REACTIONS.map((reaction) => (
                        <Tooltip key={reaction.value} content={reaction.name}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-base"
                            disabled={isReactionPending}
                            aria-label={reaction.name}
                            onClick={() => onToggleReaction(message._id, reaction.value)}
                          >
                            {reaction.label}
                          </Button>
                        </Tooltip>
                      ))}
                    </PopoverContent>
                  </Popover>
                  {showReplyActionButton ? (
                    <Tooltip content="Reply">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Reply"
                        onClick={() => onStartReply(message._id)}
                      >
                        <Reply className="size-3.5" />
                      </Button>
                    </Tooltip>
                  ) : null}
                  {!compact ? (
                    <Tooltip content="Open thread">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Open thread"
                        onClick={() => onOpenThread(message.threadRootId)}
                      >
                        <MessageSquareText className="size-3.5" />
                      </Button>
                    </Tooltip>
                  ) : null}
                  {isAuthor && (
                    <Tooltip content="Edit">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Edit"
                        onClick={() => onStartEdit(message._id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </Tooltip>
                  )}
                  <DropdownMenu open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
                    <Tooltip content="More">
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          aria-label="More message actions"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-0 w-[7.5rem] rounded-2xl"
                    >
                      {!isAuthor ? (
                        <DropdownMenuItem
                          className="rounded-xl"
                          onSelect={() => onReport?.(message._id)}
                        >
                          <Flag />
                          Report
                        </DropdownMenuItem>
                      ) : null}
                      {canPinMessages && !compact ? (
                        <DropdownMenuItem
                          className="rounded-xl"
                          disabled={isPinPending}
                          onSelect={() => onTogglePin(message._id, !message.isPinned)}
                        >
                          {message.isPinned ? <PinOff /> : <Pin />}
                          {message.isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                      ) : null}
                      {(isAuthor || canModerateMessages) && (!isAuthor || ((canPinMessages || canModerateMessages) && !compact)) ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      {(isAuthor || canModerateMessages) ? (
                        <DropdownMenuItem
                          disabled={isDeletePending}
                          className="rounded-xl text-destructive focus:text-destructive"
                          onSelect={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </MessageActions>
              </>
            ) : null}

            {!compact && message.hasReplies ? (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 w-fit"
                onClick={() => onOpenThread(message.threadRootId)}
              >
                <Reply className="size-3" />
                {message.replyCountIsExact
                  ? `${message.replyCount} ${message.replyCount === 1 ? 'reply' : 'replies'}`
                  : 'View thread'}
              </button>
            ) : null}
          </>
        )}
      </MessageContent>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                This removes the message content for everyone in the channel.
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                  <div className="text-xs">
                    Deletions are logged for school administrators. Threads keep a
                    content-free placeholder when replies exist.
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDelete(message._id)}
            >
              Delete for everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          </Message>
        </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuLabel>
          Sent {format(new Date(message.createdAt), 'PPPP \'at\' h:mm:ss a')}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <SmilePlus />
              Add reaction
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuGroup>
                {QUICK_REACTIONS.map((reaction) => (
                  <ContextMenuItem
                    key={reaction.value}
                    disabled={isReactionPending}
                    onSelect={() => onToggleReaction(message._id, reaction.value)}
                  >
                    <span className="text-base">{reaction.label}</span>
                    {reaction.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {canReply ? (
            <ContextMenuItem onSelect={() => onStartReply(message._id)}>
              <Reply />
              Reply
            </ContextMenuItem>
          ) : null}
          {!compact ? (
            <>
              <ContextMenuItem onSelect={() => onOpenThread(message.threadRootId)}>
                <MessageSquareText />
                Open thread
              </ContextMenuItem>
            </>
          ) : null}
          {isAuthor ? (
            <ContextMenuItem onSelect={() => onStartEdit(message._id)}>
              <Pencil />
              Edit
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => onReport?.(message._id)}>
              <Flag />
              Report
            </ContextMenuItem>
          )}
          {canPinMessages && !compact ? (
            <ContextMenuItem
              disabled={isPinPending}
              onSelect={() => onTogglePin(message._id, !message.isPinned)}
            >
              {message.isPinned ? <PinOff /> : <Pin />}
              {message.isPinned ? 'Unpin' : 'Pin'}
            </ContextMenuItem>
          ) : null}
        </ContextMenuGroup>
        {isAuthor || canModerateMessages ? <ContextMenuSeparator /> : null}
        {isAuthor || canModerateMessages ? (
          <ContextMenuGroup>
            <ContextMenuItem
              disabled={isDeletePending}
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <Trash2 />
              Delete
            </ContextMenuItem>
          </ContextMenuGroup>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function ChannelWorkspace() {
  const params = useParams<{ channelId: string }>();
  const channelIdParam = params?.channelId;
  if (!channelIdParam) {
    throw new Error('Channel workspace requires a channel route parameter.');
  }
  const clubId = useClubId();
  const channelId = useRouteChannelId(channelIdParam);
  const isMobile = useIsMobile();
  const isTouchPrimary = useTouchPrimary();
  const { toast } = useToast();

  const [rootComposerResetKey, setRootComposerResetKey] = useState(0);
  const [replyComposerResetKey, setReplyComposerResetKey] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [jumpedToMessageId, setJumpedToMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [jumpRequestKey, setJumpRequestKey] = useState(0);
  const [reportingMessageId, setReportingMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [friendRequestPendingId, setFriendRequestPendingId] = useState<string | null>(null);
  const [sendingMode, setSendingMode] = useState<'root' | 'thread' | null>(null);
  const [mentionContextRequested, setMentionContextRequested] = useState(false);

  // The workspace is intentionally persistent across channel navigation. Clear
  // state that belongs to the previous conversation without remounting the
  // navigation, panel layout, or outer composer surface.
  useEffect(() => {
    setEditingMessageId(null);
    setSelectedThreadId(null);
    setReplyingToMessageId(null);
    setJumpedToMessageId(null);
    setJumpRequestKey(0);
    setReportingMessageId(null);
    setReportReason('');
    setFriendRequestPendingId(null);
    setSendingMode(null);
    setMentionContextRequested(false);
    setSearch('');
  }, [channelId]);
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = useMemo(
    () => normalizeSearchQuery(deferredSearch),
    [deferredSearch],
  );

  const user = useCurrentUser();

  const conversationContext = useQuery(api.clubs.channels.getConversationContext, {
    clubId,
    channelId,
  });
  const mentionContext = useQuery(
    api.clubs.channels.getMentionContext,
    mentionContextRequested ? { clubId, channelId } : 'skip',
  );
  const {
    results: messageResults,
    status: messagePageStatus,
    loadMore: loadMoreMessages,
  } = usePaginatedQuery(
    api.clubs.channels.getMessagePage,
    { clubId, channelId },
    { initialNumItems: 50 },
  );
  const messages = useMemo(
    () =>
      [...messageResults].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [messageResults],
  );
  const latestVisibleActivity = useMemo(
    () => latestVisibleChatActivity(messages),
    [messages],
  );
  const jumpedToMessage = useQuery(
    api.clubs.channels.getMessage,
    jumpedToMessageId ? { clubId, channelId, messageId: jumpedToMessageId } : 'skip',
  );
  const selectedThreadResult = useQuery(
    api.clubs.channels.getThread,
    selectedThreadId
      ? { clubId, channelId, messageId: selectedThreadId }
      : 'skip',
  );

  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const markChannelRead = useMutation(api.clubs.channels.markRead);
  const finalizeChatAttachment = useAction(api.uploads.files.finalizeChatAttachment);
  const discardChatAttachment = useMutation(api.uploads.files.discardChatAttachment);
  const postMessage = useMutation(api.clubs.channels.postMessage).withOptimisticUpdate(
    (localStore, args) => {
      if (!user) return;
      optimisticallyInsertPostedMessage(localStore, args, {
        clubId,
        author: user,
      });
    },
  );
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction).withOptimisticUpdate(
    (localStore, args) => {
      if (!user) return;
      optimisticallyToggleMessageReaction(localStore, args, {
        clubId,
        channelId,
        currentUserId: user._id,
        threadId: selectedThreadId,
      });
    },
  );
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const submitReport = useMutation(api.moderation.reports.submitClubChannelMessage);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);

  const lastMarkedActivityRef = useRef(0);
  const lastReadAttemptAtRef = useRef(0);

  useEffect(() => {
    lastMarkedActivityRef.current = 0;
    lastReadAttemptAtRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (!latestVisibleActivity) return;

    const markVisibleActivityRead = () => {
      if (document.visibilityState !== 'visible') return;
      if (latestVisibleActivity.occurredAt <= lastMarkedActivityRef.current) return;

      const previousActivity = lastMarkedActivityRef.current;
      lastMarkedActivityRef.current = latestVisibleActivity.occurredAt;
      lastReadAttemptAtRef.current = Date.now();
      void markChannelRead({
        channelId,
        throughMessageId: latestVisibleActivity.messageId as Id<'clubChannelMessages'>,
      })
        .then(() => dismissReadChannelWebNotifications(channelId, latestVisibleActivity.occurredAt))
        .catch(() => {
          if (lastMarkedActivityRef.current === latestVisibleActivity.occurredAt) {
            lastMarkedActivityRef.current = previousActivity;
          }
        });
    };
    const delay = Math.max(
      0,
      3_000 - (Date.now() - lastReadAttemptAtRef.current),
    );
    const timeout = window.setTimeout(markVisibleActivityRead, delay);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') markVisibleActivityRead();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [channelId, latestVisibleActivity, markChannelRead]);

  const submitMessage = async ({
    body,
    bodyMarkdown,
    bodyRich,
    parentMessageId,
    replyToMessageId,
    files,
    pollQuestion,
    pollOptions,
    mode,
  }: ComposerSubmitArgs) => {
    const attachmentUploadIds: Id<'clubChannelAttachmentUploads'>[] = [];
    setSendingMode(mode);
    try {
      const uploadResults = await Promise.allSettled(
        files.map(async (file) => {
          const { storageId, uploadIntentId } = await uploadFileToConvex(
            { generateUploadUrl: () => generateUploadUrl({ purpose: 'CHAT_ATTACHMENT' }) },
            file,
          );
          return finalizeChatAttachment({
            uploadIntentId,
            storageId,
            fileName: file.name,
          });
        }),
      );
      attachmentUploadIds.push(
        ...uploadResults.flatMap((result) =>
          result.status === 'fulfilled'
            ? [result.value.attachmentUploadId]
            : [],
        ),
      );
      const failedUpload = uploadResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (failedUpload) throw failedUpload.reason;
      const messageIdentity = createClientMessageIdentity();
      const postPromise = postMessage({
        channelId,
        body: body.trim(),
        bodyMarkdown: bodyMarkdown.trim() || undefined,
        bodyRich: body.trim() ? bodyRich ?? undefined : undefined,
        parentMessageId: parentMessageId as Id<'clubChannelMessages'> | undefined,
        replyToMessageId: replyToMessageId as Id<'clubChannelMessages'> | undefined,
        pollQuestion,
        pollOptions,
        attachments: attachmentUploadIds,
        ...messageIdentity,
      });
      if (mode === 'thread') {
        setReplyComposerResetKey((current) => current + 1);
      } else {
        setReplyingToMessageId(null);
        setRootComposerResetKey((current) => current + 1);
      }
      await postPromise;
    } catch {
      await Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardChatAttachment({ attachmentUploadId }),
        ),
      );
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSendingMode(null);
    }
  };

  const channel = conversationContext?.channel;
  const canPinMessages = conversationContext?.canPinMessages ?? false;
  const canModerateMessages = conversationContext?.canModerateMessages ?? false;

  const suggestionEntries = useMemo<ChannelMentionSuggestion[]>(() => {
    const canUseAll = !!mentionContext?.canMentionEveryone;
    const builtIns: ChannelMentionSuggestion[] = [
      ...(canUseAll
        ? [{ token: 'all', label: 'Everyone', detail: '', kind: 'built-in' as const }]
        : []),
      { token: 'sponsors', label: 'Sponsors', detail: '', kind: 'built-in' },
    ];
    const tags = mentionContext?.tags.map((tag) => ({
      token: tag.slug,
      label: tag.name,
      detail: '',
      kind: 'tag' as const,
    })) ?? [];
    const groups = mentionContext?.groups.map((group) => ({
      token: group.token,
      label: group.label,
      detail: group.detail,
      kind: group.kind,
    })) ?? [];
    const people = (mentionContext?.members ?? [])
      .map((person) => ({
        token: person.uniqueId,
        label: `${person.firstName} ${person.lastName}`.trim(),
        detail: '',
        kind: 'person' as const,
      }));
    return [...builtIns, ...groups, ...tags, ...people];
  }, [mentionContext]);

  const selectedThread = selectedThreadResult?.root ?? null;
  const threadReplies = useMemo(
    () => selectedThreadResult?.replies ?? [],
    [selectedThreadResult],
  );

  const timelineMessages = useMemo(
    () =>
      jumpedToMessage && !messages.some((message) => message._id === jumpedToMessage._id)
        ? [...messages, jumpedToMessage].sort(
            (left, right) =>
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
          )
        : messages,
    [jumpedToMessage, messages],
  );
  const flattenedMessages = useMemo(
    () => [...timelineMessages, ...threadReplies],
    [threadReplies, timelineMessages],
  );
  const friendshipTargetIds = useMemo(
    () =>
      [...new Set(
        flattenedMessages
          .filter((message) => hasStudentScheduleRole(message.author.roles))
          .map((message) => message.author._id)
          .filter((userId) => userId !== user?._id),
      )].slice(0, 100),
    [flattenedMessages, user?._id],
  );
  const friendshipStatuses = useQuery(
    api.schedule.friends.getStatuses,
    hasStudentScheduleRole(user?.roles) && friendshipTargetIds.length > 0
      ? { userIds: friendshipTargetIds }
      : 'skip',
  );
  const friendshipStatusByUserId = useMemo(
    () => new Map(friendshipStatuses?.map(({ userId, status }) => [userId, status])),
    [friendshipStatuses],
  );
  const messagesById = useMemo(
    () => new Map(flattenedMessages.map((message) => [message._id, message])),
    [flattenedMessages],
  );
  const replyingToMessage = replyingToMessageId
    ? messagesById.get(replyingToMessageId) ?? null
    : null;

  const matchingIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();
    return new Set(
      filterBySearchQuery(flattenedMessages, normalizedSearch, (message) => [
        getSearchableText(message),
      ]).map((message) => message._id),
    );
  }, [flattenedMessages, normalizedSearch]);

  const visibleMessages = useMemo(() => {
    if (!normalizedSearch) return timelineMessages;
    return timelineMessages.filter((message) => matchingIds.has(message._id));
  }, [matchingIds, normalizedSearch, timelineMessages]);

  const reportingMessage = useMemo(
    () => flattenedMessages.find((message) => message._id === reportingMessageId) ?? null,
    [flattenedMessages, reportingMessageId],
  );

  const handleSubmitReport = async () => {
    if (!reportingMessage || !reportReason.trim()) return;
    await submitReport({
      messageId: reportingMessage._id as Id<'clubChannelMessages'>,
      reason: reportReason.trim(),
    });
    toast({ title: 'Report submitted' });
    setReportingMessageId(null);
    setReportReason('');
  };

  const handleSendFriendRequest = async (friendId: string) => {
    if (!hasStudentScheduleRole(user?.roles) || friendRequestPendingId) return;
    setFriendRequestPendingId(friendId);
    try {
      await sendFriendRequest({ friendId: friendId as Id<'users'> });
      toast({ title: 'Friend request sent' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to send friend request',
        variant: 'destructive',
      });
    } finally {
      setFriendRequestPendingId(null);
    }
  };

  const renderMessageRow = (
    message: ClubChannelMessage,
    compact = false,
    groupedWithPrevious = false,
  ) => {
    const isEditing = editingMessageId === message._id;

    return (
      <div>
        <MessageRow
          clubId={clubId}
          message={message}
          replyTarget={
            message.replyToMessageId
              ? messagesById.get(message.replyToMessageId)
              : undefined
          }
          currentUserId={user?._id}
          onStartReply={(messageId) => {
            setReplyingToMessageId(messageId as Id<'clubChannelMessages'>);
            setSelectedThreadId(null);
          }}
          onJumpToReply={(messageId) => {
            setReplyingToMessageId(null);
            setJumpedToMessageId(messageId as Id<'clubChannelMessages'>);
            setJumpRequestKey((key) => key + 1);
          }}
          onOpenThread={(threadId) => {
            setReplyingToMessageId(null);
            setSelectedThreadId(threadId as Id<'clubChannelMessages'>);
          }}
          onToggleReaction={(messageId, emoji) =>
            void toggleReaction({
              messageId: messageId as Id<'clubChannelMessages'>,
              emoji,
            })
          }
          onTogglePin={(messageId, pinned) =>
            void setPinned({
              messageId: messageId as Id<'clubChannelMessages'>,
              pinned,
            })
          }
          onVotePoll={(messageId, optionId) =>
            void votePoll({
              messageId: messageId as Id<'clubChannelMessages'>,
              optionId,
            })
          }
          onStartEdit={(messageId) =>
            setEditingMessageId(messageId as Id<'clubChannelMessages'>)
          }
          onDelete={(messageId) =>
            void deleteMessage({ messageId: messageId as Id<'clubChannelMessages'> }).then(() =>
              toast({ title: 'Message deleted' }),
            )
          }
          onReport={(messageId) => setReportingMessageId(messageId as Id<'clubChannelMessages'>)}
          canSendFriendRequest={hasStudentScheduleRole(user?.roles)}
          friendshipStatus={friendshipStatusByUserId.get(message.author._id)}
          onSendFriendRequest={(friendId) => void handleSendFriendRequest(friendId)}
          isEditing={isEditing}
          isReactionPending={false}
          isPinPending={false}
          isVotePending={false}
          isDeletePending={false}
          friendRequestPendingId={friendRequestPendingId}
          highlighted={matchingIds.has(message._id)}
          jumpedTo={jumpedToMessageId === message._id}
          canPinMessages={canPinMessages}
          canModerateMessages={canModerateMessages}
          openReactionDetailsOnPress={isMobile || isTouchPrimary}
          compact={compact}
          groupedWithPrevious={groupedWithPrevious}
        />
        {isEditing && (
          <div className="ml-12 mr-3 mt-1">
            <ChannelMessageComposer
              key={`edit-${message._id}`}
              suggestionEntries={suggestionEntries}
              placeholder="Edit message..."
              submitLabel="Save Changes"
              isPending={false}
              canAttach={false}
              onMentionIntent={() => setMentionContextRequested(true)}
              initialBody={message.body}
              initialBodyMarkdown={message.bodyMarkdown}
              initialBodyRich={
                Array.isArray(message.bodyRich)
                  ? (message.bodyRich as ClubChannelMessageRichBody)
                  : null
              }
              onSubmit={({ body, bodyMarkdown, bodyRich }) =>
                void updateMessage({
                  messageId: message._id,
                  body,
                  bodyMarkdown: bodyMarkdown.trim() || undefined,
                  bodyRich: bodyRich ?? undefined,
                }).then(() => setEditingMessageId(null))
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setEditingMessageId(null)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (!conversationContext || !channel) {
    return (
      <ClubWorkspace>
        <div className="flex h-full items-center justify-center py-20 text-sm text-muted-foreground">
          Channel not found or you don&apos;t have access.
        </div>
      </ClubWorkspace>
    );
  }

  const canPost = channel.viewerCanPost ?? true;
  const pinnedMessages = messages.filter((message) => message.isPinned);

  const title: ReactNode = (
    <div className="flex min-w-0 items-center gap-2">
      <ClubChannelVisibilityIcon visibility={channel.visibility} className="text-muted-foreground" />
      <h1 className="truncate text-base font-semibold text-foreground">{channel.name}</h1>
    </div>
  );

  const rightPane = selectedThread ? (
    <div className="flex size-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b py-2 pl-3 pr-12 xl:pr-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thread
          </p>
          <p className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <span className="truncate">{fullName(selectedThread.author)}</span>
            <DeveloperBadge user={selectedThread.author} size={13} />
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden size-7 xl:inline-flex"
          aria-label="Close thread"
          onClick={() => setSelectedThreadId(null)}
        >
          <X />
        </Button>
      </div>

      <MessageScrollerProvider
        key={selectedThread._id}
        autoScroll
        defaultScrollPosition="end"
      >
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-0 p-2">
              <MessageScrollerItem messageId={selectedThread._id}>
                {renderMessageRow(selectedThread)}
              </MessageScrollerItem>
              {threadReplies.map((reply, index) => (
                <MessageScrollerItem key={reply._id} messageId={reply._id}>
                  {renderMessageRow(reply, true, shouldGroupMessages(threadReplies[index - 1], reply))}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className={cn("shrink-0 border-t bg-card p-2", CARD_SURFACE_FOREGROUND)}>
        {canPost && !selectedThread.isDeleted ? (
          <ChannelMessageComposer
            key={`reply-${selectedThread._id}-${replyComposerResetKey}`}
            onSubmit={(args) => void submitMessage({ ...args, parentMessageId: selectedThread._id, mode: 'thread' })}
            isPending={sendingMode === 'thread'}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
            canCreatePoll={conversationContext.canCreatePolls}
            onMentionIntent={() => setMentionContextRequested(true)}
          />
        ) : selectedThread.isDeleted ? (
          <div className="rounded-lg border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            Replies are closed because the original message was deleted.
          </div>
        ) : (
          <div className="rounded-lg border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            {getClubChannelVisibilityLabel(channel.visibility)} channel. Only club leaders, sponsors,
            and admins can reply here.
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <ClubWorkspace
      title={title}
      rightPane={rightPane}
      resizableRightPane
      mobileRightPane={{
        title: 'Thread',
        onClose: () => setSelectedThreadId(null),
      }}
      contentClassName={cn("relative flex h-full min-h-0 flex-col bg-card", CARD_SURFACE_FOREGROUND)}
      scrollOwner="content"
      channelSearch={{
        channelName: channel.name,
        value: search,
        onValueChange: setSearch,
      }}
    >
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <ScrollToReplyTarget
          messageId={jumpedToMessageId}
          requestKey={jumpRequestKey}
          targetPresent={timelineMessages.some((message) => message._id === jumpedToMessageId)}
        />
        <div className={cn("channel-context-toolbar shrink-0 border-b bg-card px-2 py-1.5", CARD_SURFACE_FOREGROUND)}>
          <div className="mx-auto flex w-full max-w-4xl items-center gap-1">
            <ChannelNotificationSettings
              key={channelId}
              clubId={clubId}
              channelId={channelId}
              channelName={channel.name}
            />
            <PinnedMessagesButton
              messages={pinnedMessages}
              onClearSearch={() => setSearch('')}
            />
          </div>
        </div>

        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport preserveScrollOnPrepend>
            <MessageScrollerContent
              className={cn(
                'mx-auto w-full max-w-4xl p-2',
                isTouchPrimary ? 'gap-0.5 py-1.5' : 'gap-1',
              )}
            >
              {messagePageStatus === 'CanLoadMore' || messagePageStatus === 'LoadingMore' ? (
                <MessageScrollerItem>
                  <div className="flex justify-center py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={messagePageStatus === 'LoadingMore'}
                      onClick={() => loadMoreMessages(50)}
                    >
                      Load older messages
                    </Button>
                  </div>
                </MessageScrollerItem>
              ) : null}
              {visibleMessages.length > 0 ? (
                visibleMessages.map((message, index) => (
                  <MessageScrollerItem key={message._id} messageId={message._id}>
                    {renderMessageRow(message, false, shouldGroupMessages(visibleMessages[index - 1], message))}
                  </MessageScrollerItem>
                ))
              ) : messagePageStatus === 'LoadingFirstPage' ? null : (
                <MessageScrollerItem>
                  <Empty className="mt-8 border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquareText />
                      </EmptyMedia>
                      <EmptyTitle>
                        {deferredSearch.trim() ? 'No matches' : 'No messages yet'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {deferredSearch.trim()
                          ? 'No messages match this search.'
                          : canPost
                            ? `Start the conversation in ${channel.name}.`
                            : `No posts have been shared in #${channel.name} yet.`}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className={cn("channel-composer-dock shrink-0 border-t bg-card px-2 pb-2 pt-1.5", CARD_SURFACE_FOREGROUND)}>
        <div className="mx-auto max-w-4xl">
          {canPost ? (
            <div className="flex flex-col gap-1.5">
              {replyingToMessageId ? (
                <div className="flex min-w-0 items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                  <div className="min-w-0 truncate">
                    Replying to{' '}
                    <span className="font-medium text-foreground">
                      {replyingToMessage
                        ? fullName(replyingToMessage.author)
                        : 'an earlier message'}
                    </span>
                    {replyingToMessage?.body ? ` · ${replyingToMessage.body}` : ''}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    aria-label="Cancel reply"
                    onClick={() => setReplyingToMessageId(null)}
                  >
                    <X />
                  </Button>
                </div>
              ) : null}
              <ChannelMessageComposer
                key={`root-${rootComposerResetKey}`}
                onSubmit={(args) =>
                  void submitMessage({
                    ...args,
                    replyToMessageId: replyingToMessageId ?? undefined,
                    mode: 'root',
                  })
                }
                isPending={sendingMode === 'root'}
                suggestionEntries={suggestionEntries}
                placeholder={`Message #${channel.name}`}
                submitLabel="Send"
                canCreatePoll={conversationContext.canCreatePolls}
                onMentionIntent={() => setMentionContextRequested(true)}
              />
            </div>
          ) : (
            <div className="rounded-lg border bg-background/95 px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                {getClubChannelVisibilityLabel(channel.visibility)} channel
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Only leaders, sponsors, and admins can post.
              </p>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={!!reportingMessageId}
        onOpenChange={(open) => {
          if (!open) {
            setReportingMessageId(null);
            setReportReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report message</DialogTitle>
            <DialogDescription>
              Reports go to school staff for review. Include enough context to understand the issue.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm pointer-coarse:text-base outline-none focus:ring-2 focus:ring-ring"
            placeholder="Why are you reporting this message?"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setReportingMessageId(null);
                setReportReason('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmitReport()} disabled={!reportReason.trim()}>
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClubWorkspace>
        );
        }

'use client';

import { use, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import Image from 'next/image';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { AppRole } from '~/apps/convex/lib/roles';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import type { ClubChannelMessage } from '@/components/clubs/types';

type ClubChannelMessageAttachment = ClubChannelMessage['attachments'][number];
import {
  ChannelMessageComposer,
  type ChannelMentionSuggestion,
} from '@/components/clubs/channel-message-composer';
import {
  ClubChannelVisibilityIcon,
  getClubChannelVisibilityDescription,
  getClubChannelVisibilityLabel,
} from '@/components/clubs/channel-visibility';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
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

function isChannelReaction(value: string): value is ChannelReaction {
  return QUICK_REACTIONS.some((reaction) => reaction.value === value);
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
                ? 'w-52 max-w-[75vw] has-data-[slot=attachment-content]:w-full'
                : 'max-w-72',
            )}
          >
            {isImage ? (
              <AttachmentMedia
                variant="image"
                className="aspect-[3/2] w-full rounded-b-none"
              >
                <Image
                  src={href}
                  alt={attachment.fileName}
                  width={1200}
                  height={800}
                  unoptimized
                  className="size-full object-cover"
                />
              </AttachmentMedia>
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
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
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
  friendRequestPendingId,
  onSendFriendRequest,
}: {
  author: ClubChannelMessage['author'];
  compact: boolean;
  currentUserId?: string;
  canSendFriendRequest: boolean;
  friendRequestPendingId?: string | null;
  onSendFriendRequest: (userId: string) => void;
}) {
  const name = fullName(author);
  const isCurrentUser = author._id === currentUserId;
  const isStudentProfile = hasStudentScheduleRole(author.roles);
  const roleLabels = author.roles?.slice(0, 3).map((role) => formatClubRole(role) ?? role) ?? [];
  const isPending = friendRequestPendingId === author._id;
  const canOfferFriendRequest = canSendFriendRequest && !isCurrentUser && isStudentProfile;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`View ${name} profile`}
          className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
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
      </HoverCardContent>
    </HoverCard>
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

function MessageRow({
  message,
  onOpenThread,
  onToggleReaction,
  onTogglePin,
  onVotePoll,
  onStartEdit,
  onDelete,
  onShowHistory,
  onReport,
  canSendFriendRequest,
  onSendFriendRequest,
  isEditing,
  isReactionPending,
  isPinPending,
  isVotePending,
  isDeletePending,
  friendRequestPendingId,
  highlighted,
  canModerate,
  currentUserId,
  compact = false,
}: {
  message: ClubChannelMessage;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: ChannelReaction) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onStartEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onShowHistory?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  canSendFriendRequest: boolean;
  onSendFriendRequest: (userId: string) => void;
  isEditing: boolean;
  isReactionPending: boolean;
  isPinPending: boolean;
  isVotePending: boolean;
  isDeletePending: boolean;
  friendRequestPendingId?: string | null;
  highlighted: boolean;
  canModerate: boolean;
  currentUserId?: string;
  compact?: boolean;
}) {
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

  return (
    <Message
      className={cn(
        'rounded-md gap-3 px-3 transition-colors hover:bg-hover',
        compact ? 'py-1.5' : 'py-2.5',
        isSending &&
          'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
      )}
    >
      <MessageAvatar className="self-start overflow-visible bg-transparent">
        <MessageAuthorPreview
          author={message.author}
          compact={compact}
          currentUserId={currentUserId}
          canSendFriendRequest={canSendFriendRequest}
          friendRequestPendingId={friendRequestPendingId}
          onSendFriendRequest={onSendFriendRequest}
        />
      </MessageAvatar>
      <MessageContent className="gap-0">
        <MessageHeader className="gap-2 px-0 text-sm">
          <span className="text-sm font-semibold text-foreground">
            {fullName(message.author)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isSending
              ? 'Sending…'
              : formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
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

        {isEditing ? (
          <div className="mt-2" />
        ) : (
          <Bubble
            variant="ghost"
            align="start"
            className="mt-1"
          >
            {isDeleted || hasBody ? (
              <BubbleContent
                className={cn(
                  'text-sm leading-normal',
                  highlighted && 'rounded-md bg-primary/10 px-1.5 py-0.5 ring-1 ring-primary/25',
                )}
              >
                {isDeleted ? (
                  <p className="text-sm italic text-muted-foreground">Message deleted</p>
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
                  <Button
                    key={`${message._id}-${reaction.emoji}`}
                    variant="tertiary"
                    size="sm"
                    className={cn(
                      'h-7 gap-1 rounded-full px-2 text-xs shadow-none',
                      reaction.reactedByCurrentUser && 'border-primary/40 bg-primary/10',
                    )}
                    disabled={isReactionPending || !isChannelReaction(reaction.emoji)}
                    onClick={() => {
                      if (isChannelReaction(reaction.emoji)) {
                        onToggleReaction(message._id, reaction.emoji);
                      }
                    }}
                  >
                    <span>{REACTION_LABELS[reaction.emoji] ?? reaction.emoji}</span>
                    {reaction.count}
                  </Button>
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
                  {!compact ? (
                    <Tooltip content="Reply">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        aria-label="Reply"
                        onClick={() => onOpenThread(message.threadRootId)}
                      >
                        <Reply className="size-3.5" />
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
                      {canModerate && !compact ? (
                        <DropdownMenuItem
                          className="rounded-xl"
                          disabled={isPinPending}
                          onSelect={() => onTogglePin(message._id, !message.isPinned)}
                        >
                          {message.isPinned ? <PinOff /> : <Pin />}
                          {message.isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                      ) : null}
                      {(isAuthor || canModerate) && (!isAuthor || (canModerate && !compact)) ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      {(isAuthor || canModerate) ? (
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(message._id)}
            >
              Delete for everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Message>
  );
}

export default function ClubChannelPage({
  params,
}: {
  params: Promise<{ clubId: string; channelId: string }>;
}) {
  const { channelId: channelIdParam } = use(params);
  const clubId = useClubId();
  const channelId = useRouteChannelId(channelIdParam);
  const { toast } = useToast();

  const [rootComposerResetKey, setRootComposerResetKey] = useState(0);
  const [replyComposerResetKey, setReplyComposerResetKey] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [reportingMessageId, setReportingMessageId] = useState<Id<'clubChannelMessages'> | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [friendRequestPendingId, setFriendRequestPendingId] = useState<string | null>(null);
  const [sendingMode, setSendingMode] = useState<'root' | 'thread' | null>(null);
  const [mentionContextRequested, setMentionContextRequested] = useState(false);
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
  const selectedThreadResult = useQuery(
    api.clubs.channels.getThread,
    selectedThreadId
      ? { clubId, channelId, messageId: selectedThreadId }
      : 'skip',
  );

  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
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

  const submitMessage = async ({
    body,
    bodyMarkdown,
    bodyRich,
    parentMessageId,
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
        pollQuestion,
        pollOptions,
        attachments: attachmentUploadIds,
        ...messageIdentity,
      });
      if (mode === 'thread') {
        setReplyComposerResetKey((current) => current + 1);
      } else {
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

  const suggestionEntries = useMemo<ChannelMentionSuggestion[]>(() => {
    const canUseAll = !!mentionContext?.canMentionEveryone;
    const builtIns: ChannelMentionSuggestion[] = [
      ...(canUseAll
        ? [{ token: 'all', label: 'Everyone', detail: '', kind: 'built-in' as const }]
        : []),
      { token: 'leaders', label: 'Leaders', detail: '', kind: 'built-in' },
      { token: 'sponsors', label: 'Sponsors', detail: '', kind: 'built-in' },
    ];
    const tags = mentionContext?.tags.map((tag) => ({
      token: tag.slug,
      label: tag.name,
      detail: '',
      kind: 'tag' as const,
    })) ?? [];
    const people = (mentionContext?.members ?? [])
      .map((person) => ({
        token: person.uniqueId,
        label: `${person.firstName} ${person.lastName}`.trim(),
        detail: '',
        kind: 'person' as const,
      }));
    return [...builtIns, ...tags, ...people];
  }, [mentionContext]);

  const selectedThread = selectedThreadResult?.root ?? null;
  const threadReplies = useMemo(
    () => selectedThreadResult?.replies ?? [],
    [selectedThreadResult],
  );

  const flattenedMessages = useMemo(
    () => [...messages, ...threadReplies],
    [messages, threadReplies],
  );

  const matchingIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();
    return new Set(
      filterBySearchQuery(flattenedMessages, normalizedSearch, (message) => [
        getSearchableText(message),
      ]).map((message) => message._id),
    );
  }, [flattenedMessages, normalizedSearch]);

  const visibleMessages = useMemo(() => {
    if (!normalizedSearch) return messages;
    return messages.filter((message) => matchingIds.has(message._id));
  }, [matchingIds, messages, normalizedSearch]);

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

  const renderMessageRow = (message: ClubChannelMessage, compact = false) => {
    const isEditing = editingMessageId === message._id;

    return (
      <div>
        <MessageRow
          message={message}
          currentUserId={user?._id}
          onOpenThread={(threadId) => setSelectedThreadId(threadId as Id<'clubChannelMessages'>)}
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
          onSendFriendRequest={(friendId) => void handleSendFriendRequest(friendId)}
          isEditing={isEditing}
          isReactionPending={false}
          isPinPending={false}
          isVotePending={false}
          isDeletePending={false}
          friendRequestPendingId={friendRequestPendingId}
          highlighted={matchingIds.has(message._id)}
          canModerate={canModerateChannel}
          compact={compact}
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
  const canModerateChannel = conversationContext.canManageChannels;
  const pinnedMessages = messages.filter((message) => message.isPinned);

  const title: ReactNode = (
    <div className="flex min-w-0 items-center gap-2">
      <ClubChannelVisibilityIcon visibility={channel.visibility} className="text-muted-foreground" />
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-foreground">{channel.name}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {channel.description || getClubChannelVisibilityDescription(channel.visibility)}
        </p>
      </div>
    </div>
  );

  const rightPane = selectedThread ? (
    <div className="flex size-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thread
          </p>
          <p className="truncate text-sm font-medium">{fullName(selectedThread.author)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          onClick={() => setSelectedThreadId(null)}
        >
          <X className="size-4" />
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
              {threadReplies.map((reply) => (
                <MessageScrollerItem key={reply._id} messageId={reply._id}>
                  {renderMessageRow(reply, true)}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="shrink-0 border-t bg-card p-2">
        {canPost && !selectedThread.isDeleted ? (
          <ChannelMessageComposer
            key={`reply-${selectedThread._id}-${replyComposerResetKey}`}
            onSubmit={(args) => void submitMessage({ ...args, parentMessageId: selectedThread._id, mode: 'thread' })}
            isPending={sendingMode === 'thread'}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
            canCreatePoll={canModerateChannel}
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
      contentClassName="relative flex flex-col bg-card"
      scrollOwner="content"
      channelSearch={{
        channelName: channel.name,
        value: search,
        onValueChange: setSearch,
      }}
    >
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <div className="shrink-0 border-b bg-card px-2 py-1.5">
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

        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-4xl gap-1 p-2 pb-24">
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
                visibleMessages.map((message) => (
                  <MessageScrollerItem key={message._id} messageId={message._id}>
                    {renderMessageRow(message)}
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
                            ? `Start the conversation in #${channel.name}.`
                            : `No posts have been shared in #${channel.name} yet.`}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton className="data-[direction=end]:bottom-24" />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t bg-card p-2">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          {canPost ? (
            <ChannelMessageComposer
              key={`root-${rootComposerResetKey}`}
              onSubmit={(args) => void submitMessage({ ...args, mode: 'root' })}
              isPending={sendingMode === 'root'}
              suggestionEntries={suggestionEntries}
              placeholder={`Message #${channel.name}`}
              submitLabel="Send"
              canCreatePoll={canModerateChannel}
              onMentionIntent={() => setMentionContextRequested(true)}
            />
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
            className="min-h-28 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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

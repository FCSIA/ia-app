'use client';

import { displayName } from '~/apps/shared/user-name';
import { useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { formatMessageTime } from '@/lib/message-time';
import {
  Copy,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  SmilePlus,
  Trash2,
  Flag,
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
  DropdownMenu,
  DropdownContent,
  DropdownTrigger,
  DropdownSeparator,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { ReactionPicker } from './reaction-picker';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { hapticTick } from '@/lib/haptics';
import { useMessagePress, markDoubleTapLearned } from './use-message-press';
import {
  MessageActionSheet,
  type MessageSheetAction,
} from './message-action-sheet';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Button } from '@/components/ui/button';
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';
import { messageGifUrls } from '~/apps/shared/chat/gifs';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/share';
import { useToast } from '@/hooks/use-toast';
import { isChatReaction, type ChatReaction } from '~/apps/shared/chat/protocol';
import { MessageAttachments } from './message-attachments';
import { MessageBody } from './message-body';
import { MessageAuthorPreview } from './message-author-preview';
import { PollCard } from './message-poll';
import { QUICK_REACTIONS, ReactionButton } from './message-reactions';
import type { FriendshipStatus } from '@/components/users/use-friendship';

type MessageId = Id<'clubChannelMessages'>;

type MessagePermissions = { post: boolean; pin: boolean; moderate: boolean };

/** What a double tap adds until someone picks their own, as in Discord. */
export const DEFAULT_DOUBLE_TAP_REACTION: ChatReaction = 'LIKE';

/**
 * The line above a reply that names the message it answers. It sits above the
 * author, with a connector curving down to their avatar.
 */
function MessageReplyReference({
  message,
  replyTarget,
  currentUserId,
  dense,
  onJump,
}: {
  message: ClubChannelMessage;
  replyTarget?: ClubChannelMessage;
  currentUserId?: Id<'users'>;
  dense: boolean;
  onJump: () => void;
}) {
  // The server's preview covers messages outside the loaded history. `null`
  // means the original is gone; `undefined` only happens before the server
  // has answered for a message sent from this device.
  const preview = message.replyPreview;
  const author = preview ? preview.author : replyTarget?.author;
  const isDeleted = preview
    ? preview.isDeleted
    : (replyTarget?.isDeleted ?? preview === null);
  const text = preview ? preview.body : replyTarget?.body;
  const isMine = !!author && author._id === currentUserId;

  return (
    <button
      type="button"
      className={cn(
        'relative mb-1 flex h-5 w-fit min-w-0 max-w-full items-center gap-1.5 rounded text-left text-xs text-muted-foreground outline-none transition-[color,opacity] duration-150 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring active:opacity-60',
        // The connector: from above the author's avatar, curving into this line.
        'before:pointer-events-none before:absolute before:right-[calc(100%+4px)] before:top-1/2 before:h-[calc(50%+2px)] before:rounded-tl-md before:border-l-2 before:border-t-2 before:border-muted-foreground/30',
        dense ? 'before:w-6' : 'before:w-[26px]',
      )}
      onClick={onJump}
    >
      <span className="sr-only">In reply to</span>
      {author ? (
        <UserAvatar
          person={author}
          className="size-4"
          fallbackClassName="text-[7px]"
        />
      ) : null}
      <span
        className={cn(
          'shrink-0 font-medium',
          isMine ? 'text-primary' : 'text-foreground',
        )}
      >
        {author ? (isMine ? 'You' : displayName(author)) : 'Original message'}
      </span>
      <span className={cn('truncate', isDeleted && 'italic')}>
        {isDeleted
          ? 'Message deleted'
          : author
            ? text || 'Attachment'
            : 'Tap to view'}
      </span>
    </button>
  );
}

export function MessageRow({
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
  onCopyText,
  onReport,
  doubleTapReaction,
  onChangeDoubleTapReaction,
  canSendFriendRequest,
  friendshipStatus,
  onSendFriendRequest,
  isEditing,
  friendRequestPendingId,
  replying,
  editor,
  jumpedTo,
  permissions,
  currentUserId,
  compact = false,
  groupedWithPrevious = false,
}: {
  clubId: Id<'clubs'>;
  message: ClubChannelMessage;
  replyTarget?: ClubChannelMessage;
  onStartReply: (messageId: MessageId) => void;
  onJumpToReply: (messageId: MessageId) => void;
  onOpenThread: (messageId: MessageId) => void;
  onToggleReaction: (messageId: MessageId, emoji: ChatReaction) => void;
  onTogglePin: (messageId: MessageId, pinned: boolean) => void;
  onVotePoll: (messageId: MessageId, optionId: string) => void;
  onStartEdit: (messageId: MessageId) => void;
  onDelete: (messageId: MessageId) => void;
  onCopyText: (message: ClubChannelMessage) => void;
  onReport?: (messageId: MessageId) => void;
  doubleTapReaction: ChatReaction;
  onChangeDoubleTapReaction: (reaction: ChatReaction) => void;
  canSendFriendRequest: boolean;
  friendshipStatus?: FriendshipStatus;
  onSendFriendRequest: (userId: Id<'users'>) => void;
  isEditing: boolean;
  friendRequestPendingId?: Id<'users'> | null;
  replying: boolean;
  editor?: ReactNode;
  jumpedTo: boolean;
  permissions: MessagePermissions;
  currentUserId?: Id<'users'>;
  compact?: boolean;
  groupedWithPrevious?: boolean;
}) {
  const isTouchPrimary = useTouchPrimary();
  const {
    post: canPost,
    pin: canPinMessages,
    moderate: canModerateMessages,
  } = permissions;
  const { toast } = useToast();
  // Previewed GIF links and GIF uploads, copied from the message's own menu.
  const gifUrls = message.isDeleted ? [] : messageGifUrls(message);
  const copyGifUrl = (url: string) => {
    void copyText(url).then(
      () => toast({ title: 'GIF URL copied' }),
      () =>
        toast({ title: 'Could not copy the GIF URL', variant: 'destructive' }),
    );
  };
  // Thread replies are always compact; on touch-primary devices every row
  // uses the compact rhythm so more of the conversation fits above the
  // keyboard. Type sizes stay untouched — the win is spacing, not legibility.
  const dense = compact || isTouchPrimary;
  const isAuthor = message.author._id === currentUserId;
  const isDeleted = message.isDeleted;
  const isEdited = !isDeleted && !!message.editedAt;
  const isSending =
    'deliveryState' in message && message.deliveryState === 'sending';
  const hasBody = message.body.trim().length > 0;
  const hasReactions =
    !isDeleted && !isEditing && !isSending && message.reactions.length > 0;
  const canAct = !isDeleted && !isSending && !isEditing;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const replySwipeStart = useRef<{
    x: number;
    y: number;
    identifier: number;
    swiping: boolean;
  } | null>(null);
  const replySwipeContentRef = useRef<HTMLDivElement>(null);
  // Replies go to the channel composer, so they need a channel you can post in.
  const canReply = !compact && canPost;
  const canSwipeToReply = isTouchPrimary && canAct && canReply;
  // Swipe-to-reply is an enhancement, never the only route: the hover action bar
  // is pointer-only anyway, so touch-primary devices keep Reply in the hold
  // sheet, and pointers in the context menu, which keyboards also reach.
  const showReplyActionButton = canReply && !isTouchPrimary;
  const repliesToViewer =
    !!currentUserId &&
    (message.replyPreview?.author._id ?? replyTarget?.author._id) ===
      currentUserId;
  // Discord-style: replies to you and mentions that reached you stand out.
  const pingsViewer =
    !isAuthor &&
    !isDeleted &&
    !isSending &&
    (repliesToViewer || !!message.mentionsViewer);
  const doubleTapOption =
    QUICK_REACTIONS.find((reaction) => reaction.value === doubleTapReaction) ??
    QUICK_REACTIONS[0];
  const doubleTapReacted = message.reactions.some(
    (reaction) =>
      reaction.emoji === doubleTapOption.value && reaction.reactedByCurrentUser,
  );

  const pressHandlers = useMessagePress({
    enabled: isTouchPrimary && canAct,
    onLongPress: () => {
      replySwipeStart.current = null;
      setActionSheetOpen(true);
    },
    onDoubleTap: (point) => {
      const rect = rowRef.current?.getBoundingClientRect();
      if (rect) {
        setReactionBurst({
          key: Date.now(),
          x: point.x - rect.left,
          y: point.y - rect.top,
        });
      }
      hapticTick();
      markDoubleTapLearned();
      // Like a double-tap like elsewhere: it adds, and never takes back.
      if (!doubleTapReacted) {
        onToggleReaction(message._id, doubleTapOption.value);
      }
    },
  });

  // The swipe writes straight to the element: a state update per touchmove would
  // re-render the whole row every frame.
  const setReplySwipeOffset = (offset: number) => {
    const content = replySwipeContentRef.current;
    if (!content) return;
    content.style.transition = 'none';
    content.style.willChange = 'transform';
    content.style.transform = `translateX(${offset}px)`;
    rowRef.current?.toggleAttribute('data-reply-swiping', offset !== 0);
  };

  const resetReplySwipe = () => {
    replySwipeStart.current = null;
    const content = replySwipeContentRef.current;
    if (content) {
      // Dropping the inline transition hands back to the class transition, so
      // the row settles from wherever the finger left it.
      content.style.transition = '';
      content.style.willChange = '';
      content.style.transform = '';
    }
    rowRef.current?.removeAttribute('data-reply-swiping');
  };

  const reactionOptions = QUICK_REACTIONS.map((reaction) => ({
    ...reaction,
    selected: message.reactions.some(
      (existing) =>
        existing.emoji === reaction.value && existing.reactedByCurrentUser,
    ),
  }));
  const sheetActionGroups: MessageSheetAction[][] = [
    [
      ...(canReply
        ? [
            {
              key: 'reply',
              label: 'Reply',
              icon: Reply,
              onSelect: () => onStartReply(message._id),
            },
          ]
        : []),
      ...(!compact
        ? [
            {
              key: 'thread',
              label: 'Open thread',
              icon: MessageSquareText,
              onSelect: () => onOpenThread(message.threadRootId),
            },
          ]
        : []),
      ...(isAuthor
        ? [
            {
              key: 'edit',
              label: 'Edit message',
              icon: Pencil,
              onSelect: () => onStartEdit(message._id),
            },
          ]
        : []),
    ],
    [
      ...(hasBody
        ? [
            {
              key: 'copy',
              label: 'Copy text',
              icon: Copy,
              onSelect: () => onCopyText(message),
            },
          ]
        : []),
      // The hold sheet replaces the right-click menu on touch, GIF links included.
      ...gifUrls.map((url, index) => ({
        key: `gif-${url}`,
        label:
          gifUrls.length === 1 ? 'Copy GIF URL' : `Copy GIF ${index + 1} URL`,
        icon: Link2,
        onSelect: () => copyGifUrl(url),
      })),
      ...(canPinMessages && !compact
        ? [
            {
              key: 'pin',
              label: message.isPinned ? 'Unpin message' : 'Pin message',
              icon: message.isPinned ? PinOff : Pin,
              onSelect: () => onTogglePin(message._id, !message.isPinned),
            },
          ]
        : []),
      ...(!isAuthor
        ? [
            {
              key: 'report',
              label: 'Report message',
              icon: Flag,
              onSelect: () => onReport?.(message._id),
            },
          ]
        : []),
    ],
    isAuthor || canModerateMessages
      ? [
          {
            key: 'delete',
            label: 'Delete message',
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleteDialogOpen(true),
          },
        ]
      : [],
  ];

  return (
    <>
      <ContextMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        {/* Touch-first devices use the hold sheet below instead of this menu. */}
        <ContextMenuTrigger asChild disabled={!canAct || isTouchPrimary}>
          <div
            ref={rowRef}
            data-selected={
              actionSheetOpen ||
              actionsMenuOpen ||
              contextMenuOpen ||
              reactionPickerOpen
                ? ''
                : undefined
            }
            className={cn(
              'group/row relative [touch-action:pan-y_pinch-zoom]',
              // On touch, a hold opens the actions; it never selects text, shows
              // the iOS callout, or lifts a link or image to drag. Copy text is
              // in the sheet. Pointers keep normal text selection.
              isTouchPrimary &&
                'select-none [-webkit-touch-callout:none] [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none]',
            )}
            {...pressHandlers}
          >
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-0 end-3 flex translate-x-1 items-center text-primary opacity-0 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none group-data-[reply-swiping]/row:translate-x-0 group-data-[reply-swiping]/row:opacity-100',
              )}
            >
              <Reply className="size-4" />
            </div>
            <div
              ref={replySwipeContentRef}
              // `isolate` keeps the per-row stacking context without promoting
              // every message to a GPU layer; the swipe adds will-change itself.
              className="relative isolate transition-transform duration-200 ease-out motion-reduce:transition-none"
              onTouchStart={(event) => {
                if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1) {
                  if (replySwipeStart.current) resetReplySwipe();
                  return;
                }
                if (!canSwipeToReply) return;
                // Touches inside a dialog opened from this row are not swipes on it.
                if (
                  !(event.target instanceof Element) ||
                  !event.currentTarget.contains(event.target)
                )
                  return;
                if (
                  event.target.closest(
                    'button, a, input, textarea, [contenteditable=true], [data-message-gallery]',
                  )
                )
                  return;
                const touch = event.touches[0];
                replySwipeStart.current = {
                  x: touch.clientX,
                  y: touch.clientY,
                  identifier: touch.identifier,
                  swiping: false,
                };
              }}
              onTouchMove={(event) => {
                const start = replySwipeStart.current;
                if (!start) return;
                if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1) {
                  resetReplySwipe();
                  return;
                }
                const touch = event.touches[0];
                if (touch.identifier !== start.identifier) {
                  resetReplySwipe();
                  return;
                }
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
                setReplySwipeOffset(Math.max(-48, Math.min(0, deltaX)));
              }}
              onTouchEnd={(event) => {
                const start = replySwipeStart.current;
                const touch = event.changedTouches[0];
                if (
                  start?.swiping &&
                  event.touches.length === 0 &&
                  event.changedTouches.length === 1 &&
                  touch?.identifier === start.identifier &&
                  (window.visualViewport?.scale ?? 1) <= 1 &&
                  start.x - touch.clientX >= 48
                ) {
                  setReplySwipeOffset(-48);
                  hapticTick();
                  onStartReply(message._id);
                }
                resetReplySwipe();
              }}
              onTouchCancel={resetReplySwipe}
            >
              <Message
                grouped={groupedWithPrevious}
                data-replying={replying || undefined}
                className={cn(
                  'rounded-md px-3 transition-colors duration-150 hover:bg-hover',
                  dense ? 'gap-2.5' : 'gap-3',
                  // Pressed (set by the press handlers) and selected (sheet open).
                  'group-data-[pressed]/row:bg-active group-data-[pressed]/row:duration-75 group-data-[selected]/row:bg-active',
                  pingsViewer &&
                    'bg-[hsl(var(--mention-surface))] shadow-[inset_2px_0_0_hsl(var(--mention))]',
                  jumpedTo &&
                    'bg-primary/10 ring-1 ring-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                  replying &&
                    'bg-primary/5 shadow-[inset_2px_0_0_hsl(var(--primary))]',
                )}
              >
                <MessageAvatar
                  className={cn(
                    'self-start overflow-visible bg-transparent',
                    dense && 'w-7',
                    // Level with the author's name below the reply line.
                    message.replyToMessageId && !groupedWithPrevious && 'mt-6',
                  )}
                >
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
                  ) : (
                    <time
                      dateTime={message.createdAt}
                      className="block pt-0.5 text-center text-[10px] tabular-nums tracking-tight text-muted-foreground opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-coarse:opacity-100"
                    >
                      {format(new Date(message.createdAt), 'h:mm')}
                    </time>
                  )}
                </MessageAvatar>
                <MessageContent className="gap-0">
                  {message.replyToMessageId ? (
                    <MessageReplyReference
                      message={message}
                      replyTarget={replyTarget}
                      currentUserId={currentUserId}
                      dense={dense}
                      onJump={() => onJumpToReply(message.replyToMessageId!)}
                    />
                  ) : null}
                  {!groupedWithPrevious ? (
                    <MessageHeader className="gap-2 px-0 text-[13px]">
                      <MessageAuthorPreview
                        author={message.author}
                        compact={dense}
                        triggerVariant="name"
                        currentUserId={currentUserId}
                        canSendFriendRequest={canSendFriendRequest}
                        friendshipStatus={friendshipStatus}
                        friendRequestPendingId={friendRequestPendingId}
                        onSendFriendRequest={onSendFriendRequest}
                      />
                      {message.author.clubRole &&
                      !message.author.clubRole.isDefault ? (
                        <span className="text-xs text-muted-foreground">
                          · {message.author.clubRole.name}
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {isSending
                          ? 'Sending…'
                          : formatMessageTime(message.createdAt)}
                      </span>
                      {message.isPinned ? (
                        <Tooltip content="Pinned message">
                          <span className="text-muted-foreground">
                            <Pin
                              className="size-3"
                              aria-label="Pinned message"
                            />
                          </span>
                        </Tooltip>
                      ) : null}
                      {isEdited ? (
                        <Tooltip
                          content={`Edited ${formatMessageTime(message.editedAt!, 'full')}`}
                        >
                          <span className="text-xs text-muted-foreground">
                            (edited)
                          </span>
                        </Tooltip>
                      ) : null}
                    </MessageHeader>
                  ) : null}

                  {isEditing ? (
                    editor
                  ) : (
                    <div
                      className={cn('min-w-0', !groupedWithPrevious && 'mt-1')}
                    >
                      {isDeleted || hasBody ? (
                        <div className="max-w-[75ch]">
                          {isDeleted ? (
                            <p className="text-[13px] italic text-muted-foreground">
                              Message deleted
                            </p>
                          ) : (
                            <MessageBody message={message} />
                          )}
                        </div>
                      ) : null}
                      {!isDeleted ? (
                        <>
                          <PollCard
                            message={message}
                            onVote={onVotePoll}
                          />
                          <MessageAttachments
                            attachments={message.attachments}
                          />
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
                              currentUserId={currentUserId}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!isEditing && (
                    <>
                      {/* Touch devices use the hold sheet: on a phone a tap leaves
                this bar stuck open, and its hidden buttons caught taps. */}
                      {!isDeleted && !isSending && !isTouchPrimary ? (
                        <>
                          <MessageActions
                            className={cn(
                              'pointer-events-none rounded-xl bg-surface-3 p-0.5 opacity-0 shadow-surface-3 transition-opacity duration-150 motion-reduce:transition-none group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100',
                              (reactionPickerOpen ||
                                actionsMenuOpen ||
                                deleteDialogOpen) &&
                                'pointer-events-auto opacity-100',
                            )}
                          >
                            <Popover
                              open={reactionPickerOpen}
                              onOpenChange={setReactionPickerOpen}
                            >
                              <Tooltip content="Add reaction">
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-compact"
                                    aria-label="Add reaction"
                                  >
                                    <SmilePlus />
                                  </Button>
                                </PopoverTrigger>
                              </Tooltip>
                              <PopoverContent
                                side="top"
                                align="end"
                                className="w-auto p-1"
                              >
                                <ReactionPicker
                                  reactions={reactionOptions}
                                  onPick={(value, keepOpen) => {
                                    if (isChatReaction(value))
                                      onToggleReaction(message._id, value);
                                    if (!keepOpen) setReactionPickerOpen(false);
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            {showReplyActionButton ? (
                              <Tooltip content="Reply">
                                <Button
                                  variant="ghost"
                                  size="icon-compact"
                                  aria-label="Reply"
                                  onClick={() => onStartReply(message._id)}
                                >
                                  <Reply />
                                </Button>
                              </Tooltip>
                            ) : null}
                            {!compact && !isTouchPrimary ? (
                              <Tooltip content="Open thread">
                                <Button
                                  variant="ghost"
                                  size="icon-compact"
                                  aria-label="Open thread"
                                  onClick={() =>
                                    onOpenThread(message.threadRootId)
                                  }
                                >
                                  <MessageSquareText />
                                </Button>
                              </Tooltip>
                            ) : null}
                            {isAuthor && (
                              <Tooltip content="Edit">
                                <Button
                                  variant="ghost"
                                  size="icon-compact"
                                  aria-label="Edit"
                                  onClick={() => onStartEdit(message._id)}
                                >
                                  <Pencil />
                                </Button>
                              </Tooltip>
                            )}
                            <DropdownMenu
                              open={actionsMenuOpen}
                              onOpenChange={setActionsMenuOpen}
                            >
                              <Tooltip content="More">
                                <DropdownTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-compact"
                                      aria-label="More message actions"
                                    >
                                      <MoreHorizontal />
                                    </Button>
                                  }
                                />
                              </Tooltip>
                              <DropdownContent
                                align="end"
                                onCloseAutoFocus={(event) =>
                                  event.preventDefault()
                                }
                              >
                                {sheetActionGroups
                                  .filter((group) => group.length)
                                  .map((group, groupIndex) => (
                                    <div key={groupIndex}>
                                      {groupIndex ? (
                                        <DropdownSeparator />
                                      ) : null}
                                      {group.map((action, index) => (
                                        <MenuItem
                                          key={action.key}
                                          index={groupIndex * 20 + index}
                                          label={action.label}
                                          icon={action.icon}
                                          disabled={action.disabled}
                                          className={cn(
                                            action.destructive &&
                                              'text-destructive',
                                          )}
                                          onClick={(event) => {
                                            if (
                                              action.key === 'delete' &&
                                              event.shiftKey
                                            ) {
                                              event.preventDefault();
                                              setActionsMenuOpen(false);
                                              onDelete(message._id);
                                            } else action.onSelect();
                                          }}
                                        />
                                      ))}
                                    </div>
                                  ))}
                              </DropdownContent>
                            </DropdownMenu>
                          </MessageActions>
                        </>
                      ) : null}

                      {!compact && !isTouchPrimary && message.hasReplies ? (
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
              </Message>
            </div>
            {reactionBurst ? (
              <span
                key={reactionBurst.key}
                aria-hidden="true"
                className="pointer-events-none absolute z-30 text-4xl leading-none drop-shadow-sm animate-reaction-burst motion-reduce:hidden"
                style={{ left: reactionBurst.x, top: reactionBurst.y }}
                onAnimationEnd={() => setReactionBurst(null)}
              >
                {doubleTapOption.label}
              </span>
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="w-48"
          // Leave focus where the action put it, e.g. the composer after Reply.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
            {formatMessageTime(message.createdAt, 'full')}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <SmilePlus />
              Add reaction
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-auto p-2">
              <ReactionPicker
                reactions={reactionOptions}
                onPick={(value, keepOpen) => {
                  if (isChatReaction(value))
                    onToggleReaction(message._id, value);
                  if (!keepOpen) setContextMenuOpen(false);
                }}
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
          {sheetActionGroups
            .filter((group) => group.length)
            .map((group, index) => (
              <ContextMenuGroup key={index}>
                {index ? <ContextMenuSeparator /> : null}
                {group.map((action) => (
                  <ContextMenuItem
                    key={action.key}
                    disabled={action.disabled}
                    className={cn(action.destructive && 'text-destructive')}
                    onSelect={action.onSelect}
                    onClick={(event) => {
                      if (action.key === 'delete' && event.shiftKey) {
                        event.preventDefault();
                        setContextMenuOpen(false);
                        onDelete(message._id);
                      }
                    }}
                  >
                    <action.icon />
                    {action.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuGroup>
            ))}
        </ContextMenuContent>
      </ContextMenu>
      {isTouchPrimary ? (
        <MessageActionSheet
          open={actionSheetOpen}
          onOpenChange={setActionSheetOpen}
          preview={{
            avatar: (
              <UserAvatar
                person={message.author}
                className="size-9"
                fallbackClassName="text-[11px]"
              />
            ),
            authorName: displayName(message.author),
            sentAt: formatMessageTime(message.createdAt, 'full'),
            text: message.body.trim()
              ? message.body
              : message.poll
                ? `Poll: ${message.poll.question}`
                : message.attachments.length > 0
                  ? `${message.attachments.length} ${message.attachments.length === 1 ? 'attachment' : 'attachments'}`
                  : '',
          }}
          reactions={reactionOptions}
          doubleTap={{
            value: doubleTapOption.value,
            onChange: (value) => {
              if (isChatReaction(value)) onChangeDoubleTapReaction(value);
            },
          }}
          onReact={(value) => {
            if (isChatReaction(value)) onToggleReaction(message._id, value);
          }}
          actionGroups={sheetActionGroups}
        />
      ) : null}
      {/* Outside the row, so touches in the dialog never reach the row's gestures. */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <div className="my-2 flex gap-3 rounded-lg bg-muted/60 p-3">
              <UserAvatar person={message.author} className="size-9" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {displayName(message.author)}
                </p>
                <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {message.body ||
                    message.poll?.question ||
                    message.attachments
                      .map((attachment) => attachment.fileName)
                      .join(', ')}
                </p>
              </div>
            </div>
            <AlertDialogDescription>
              This deletes the message for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDelete(message._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

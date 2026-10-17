'use client';

import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, isSameDay, isSameYear, isToday, isYesterday } from 'date-fns';

function formatChatTimestamp(value: number | string | Date) {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) return format(date, 'h:mm a');
  if (isSameYear(date, now)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}

/** The full send time, for the message action sheet. */
function formatSheetTimestamp(value: number | string | Date) {
  const date = new Date(value);
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`;
  if (isSameYear(date, new Date())) return format(date, "EEE, MMM d 'at' h:mm a");
  return format(date, "MMM d, yyyy 'at' h:mm a");
}
import { useAction, useMutation, usePaginatedQuery, useQuery } from '@/lib/convex-react';
import {
  BarChart3,
  Copy,
  FileText,
  History,
  Link2,
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
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { ChannelWhiteboard } from '@/components/clubs/whiteboard/channel-whiteboard';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { AppRole } from '~/apps/convex/lib/roles';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { hapticTick } from '@/lib/haptics';
import { useMessagePress } from '@/components/clubs/use-message-press';
import {
  MessageActionSheet,
  type MessageSheetAction,
} from '@/components/clubs/message-action-sheet';
import type { ViewerImage } from '@/components/clubs/image-viewer';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { latestVisibleChatActivity } from '~/apps/shared/chat/activity';
import { firstUnreadChannelMessageId } from '~/apps/shared/chat/unread-boundary';
import { useChannelUnreadBoundary } from '@/hooks/use-channel-unread-boundary';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { dismissReadChannelWebNotifications } from '@/lib/push-notifications';

type ClubChannelMessageAttachment = ClubChannelMessage['attachments'][number];
import {
  ChannelMessageComposer,
  type ChannelMentionSuggestion,
  type ChannelMessageComposerHandle,
} from '@/components/clubs/channel-message-composer';
import {
  ClubChannelVisibilityIcon,
  getClubChannelVisibilityLabel,
} from '@/components/clubs/channel-visibility';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { PresenceAvatar, useMemberPresence } from '@/components/presence/club-presence';
import { UserProfileContent, UserProfileDialog } from '@/components/clubs/user-profile-dialog';
import {
  MentionBody,
  type ClubChannelMessageRichBody,
} from '@/components/clubs/mention-body';
import { fullName } from '@/components/clubs/types';
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
import { BugHunterTag } from '@/components/recognition/bug-hunter-tag';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
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
import { ChatGif, ChatGifLinks } from '@/components/clubs/chat-gif';
import { isGifAttachment, messageGifUrls } from '~/apps/shared/chat/gifs';
import { useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery, normalizeSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/share';
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
  { value: 'SKULL', label: '💀', name: 'Skull' },
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
  // A reply always shows its author, with the line naming what it answers.
  if (current.replyToMessageId) return false;
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

// Loaded on first open, so the viewer costs the chat nothing until then.
const ImageViewer = dynamic(
  () => import('@/components/clubs/image-viewer').then((module) => module.ImageViewer),
  { ssr: false },
);

type ImageViewerRequest = { images: ViewerImage[]; index: number };

/**
 * Opens the channel's single image viewer. It lives outside the message rows,
 * so their gestures and context menu never see its events.
 */
const ImageViewerContext = createContext<(request: ImageViewerRequest) => void>(() => {});

function toViewerImage(attachment: ClubChannelMessageAttachment): ViewerImage {
  return {
    src: attachment.fileUrl,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
  };
}

function MessageAttachmentCard({
  attachment,
  fillAvailableWidth = false,
  onOpenImage,
}: {
  attachment: ClubChannelMessageAttachment;
  fillAvailableWidth?: boolean;
  onOpenImage?: () => void;
}) {
  const href = attachment.fileUrl;
  const isImage = isImageAttachment(attachment);

  if (isGifAttachment(attachment)) {
    return <ChatGif key={href} src={href} name={attachment.fileName} />;
  }

  return (
    <Attachment
      size="sm"
      orientation={isImage ? 'vertical' : 'horizontal'}
      className={cn(
        isImage
          ? fillAvailableWidth
            ? 'w-full! max-w-full has-data-[slot=attachment-content]:w-full'
            : 'w-fit! max-w-[85vw] sm:max-w-[min(100%,42rem)] has-data-[slot=attachment-content]:w-full'
          : fillAvailableWidth
            ? 'w-full max-w-full'
            : 'max-w-72',
      )}
    >
      {isImage ? (
        <div className="max-h-[min(60vh,32rem)] max-w-full overflow-hidden rounded-t-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={attachment.fileName}
            className={cn(
              'block h-auto max-h-[min(60vh,32rem)] max-w-full object-contain',
              fillAvailableWidth ? 'w-full' : 'w-auto',
            )}
          />
        </div>
      ) : (
        <AttachmentMedia>
          <FileText />
        </AttachmentMedia>
      )}
      <AttachmentContent>
        <AttachmentTitle>{attachment.fileName}</AttachmentTitle>
        <AttachmentDescription>{getAttachmentDescription(attachment)}</AttachmentDescription>
      </AttachmentContent>
      {isImage && onOpenImage ? (
        <AttachmentTrigger aria-label={`View ${attachment.fileName}`} onClick={onOpenImage} />
      ) : (
        <AttachmentTrigger asChild aria-label={`Open ${attachment.fileName} in a new tab`}>
          <a href={href} target="_blank" rel="noreferrer" />
        </AttachmentTrigger>
      )}
    </Attachment>
  );
}

function MessageAttachments({ attachments }: { attachments: ClubChannelMessageAttachment[] }) {
  const openImageViewer = useContext(ImageViewerContext);
  if (attachments.length === 0) return null;

  // The viewer pages through this message's images, starting at the one tapped.
  const images = attachments.filter(isImageAttachment);
  const openImage = (attachment: ClubChannelMessageAttachment) =>
    isImageAttachment(attachment)
      ? () =>
          openImageViewer({
            images: images.map(toViewerImage),
            index: images.findIndex((image) => image._id === attachment._id),
          })
      : undefined;

  if (attachments.length === 1) {
    return (
      <AttachmentGroup className="mt-2 max-w-full gap-2 py-0">
        <MessageAttachmentCard attachment={attachments[0]} onOpenImage={openImage(attachments[0])} />
      </AttachmentGroup>
    );
  }

  return <MessageAttachmentGallery attachments={attachments} openImage={openImage} />;
}

function MessageAttachmentGallery({
  attachments,
  openImage,
}: {
  attachments: ClubChannelMessageAttachment[];
  openImage: (attachment: ClubChannelMessageAttachment) => (() => void) | undefined;
}) {
  return (
    // Swiping the gallery pages through attachments; it never starts a reply
    // or opens the club navigation.
    <section
      className="mt-2 max-w-full"
      aria-label={`${attachments.length} message attachments`}
      data-message-gallery
      data-swipe-navigation-ignore
    >
      <Carousel
        opts={{ align: 'start', containScroll: 'trimSnaps' }}
        className="max-w-full"
        aria-label="Message attachments"
      >
        <CarouselContent className="ml-0">
          {attachments.map((attachment, index) => (
            <CarouselItem
              key={attachment._id}
              // Own compositing layer per slide: iOS Safari otherwise can skip
              // painting an image that is translated into view.
              className="pl-0 [backface-visibility:hidden] [transform:translateZ(0)]"
              aria-label={`${index + 1} of ${attachments.length}: ${attachment.fileName}`}
            >
              <MessageAttachmentCard
                attachment={attachment}
                fillAvailableWidth
                onOpenImage={openImage(attachment)}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Inside the gallery: the default outside offset widened the chat
            past the screen and let it scroll sideways on phones. */}
        <CarouselPrevious
          aria-label="Previous attachment"
          className="left-2 bg-background/85 shadow-sm backdrop-blur disabled:hidden"
        />
        <CarouselNext
          aria-label="Next attachment"
          className="right-2 bg-background/85 shadow-sm backdrop-blur disabled:hidden"
        />
      </Carousel>
    </section>
  );
}

function MessageBody({ message }: { message: ClubChannelMessage }) {
  return (
    <>
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
      <ChatGifLinks text={message.bodyMarkdown || message.body} />
    </>
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
                        <BugHunterTag user={message.author} />
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
  triggerVariant = 'avatar',
  currentUserId,
  canSendFriendRequest,
  friendshipStatus,
  friendRequestPendingId,
  onSendFriendRequest,
}: {
  author: ClubChannelMessage['author'];
  compact: boolean;
  triggerVariant?: 'avatar' | 'name';
  currentUserId?: string;
  canSendFriendRequest: boolean;
  friendshipStatus?: FriendshipStatus;
  friendRequestPendingId?: string | null;
  onSendFriendRequest: (userId: string) => void;
}) {
  const name = fullName(author);
  const isCurrentUser = author._id === currentUserId;
  const isPending = friendRequestPendingId === author._id;
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const presence = useMemberPresence(author._id);

  const trigger =
    triggerVariant === 'name' ? (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className="inline-flex min-w-0 items-center gap-1 rounded-sm py-0.5 text-[13px] font-semibold text-foreground outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => {
          setHoverOpen(false);
          setProfileOpen(true);
        }}
      >
        <span className="truncate">{name}</span>
        <DeveloperBadge user={author} size={13} />
        <BugHunterTag user={author} />
      </button>
    ) : (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
        onClick={() => {
          setHoverOpen(false);
          setProfileOpen(true);
        }}
      >
        <PresenceAvatar status={presence}>
          <ClubAvatar
            person={author}
            className={compact ? 'size-7' : 'size-9'}
            fallbackClassName={compact ? 'text-[10px]' : 'text-[11px]'}
          />
        </PresenceAvatar>
      </button>
    );

  return (
    <>
      <HoverCard open={hoverOpen} onOpenChange={setHoverOpen} openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent
          side={triggerVariant === 'avatar' ? 'left' : 'top'}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="w-[min(23rem,calc(100vw-1.5rem))] rounded-lg p-0"
        >
          <UserProfileContent
            active={hoverOpen}
            person={author}
            isCurrentUser={isCurrentUser}
            canSendFriendRequest={canSendFriendRequest}
            friendshipStatus={friendshipStatus}
            friendRequestPending={isPending}
            onSendFriendRequest={onSendFriendRequest}
            variant="preview"
          />
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

/**
 * How far from the newest message the chat still counts as "at the bottom":
 * new messages keep following, and the jump button stays hidden, until the
 * reader has scrolled about two messages up.
 */
const CHAT_SCROLL_EDGE_THRESHOLD = 160;
/**
 * On touch, nothing in the timeline selects as text or shows the iOS callout,
 * including the jump button and markers; Copy text lives in the hold sheet.
 */
const TOUCH_TIMELINE_CLASS = 'select-none [-webkit-touch-callout:none]';
/** The jump-to-latest button sits in the corner, clear of message text. */
const CHAT_SCROLL_BUTTON_CLASS =
  'inset-s-auto inset-e-3 translate-x-0 rtl:translate-x-0 shadow-md data-[direction=end]:bottom-3';

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

/** What the viewer may do with messages in this channel. */
type MessagePermissions = { post: boolean; pin: boolean; moderate: boolean };

/** What a double tap adds until someone picks their own, as in Discord. */
const DEFAULT_DOUBLE_TAP_REACTION: ChannelReaction = 'LIKE';

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
  currentUserId?: string;
  dense: boolean;
  onJump: () => void;
}) {
  // The server's preview covers messages outside the loaded history. `null`
  // means the original is gone; `undefined` only happens before the server
  // has answered for a message sent from this device.
  const preview = message.replyPreview;
  const author = preview ? preview.author : replyTarget?.author;
  const isDeleted = preview ? preview.isDeleted : (replyTarget?.isDeleted ?? preview === null);
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
        <ClubAvatar person={author} className="size-4" fallbackClassName="text-[7px]" />
      ) : null}
      <span className={cn('shrink-0 font-medium', isMine ? 'text-primary' : 'text-foreground/85')}>
        {author ? (isMine ? 'You' : fullName(author)) : 'Original message'}
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
  onCopyText,
  onShowHistory,
  onReport,
  doubleTapReaction,
  onChangeDoubleTapReaction,
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
  permissions,
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
  onCopyText: (message: ClubChannelMessage) => void;
  onShowHistory?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  doubleTapReaction: ChannelReaction;
  onChangeDoubleTapReaction: (reaction: ChannelReaction) => void;
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
  permissions: MessagePermissions;
  currentUserId?: string;
  openReactionDetailsOnPress: boolean;
  compact?: boolean;
  groupedWithPrevious?: boolean;
}) {
  const isTouchPrimary = useTouchPrimary();
  const { post: canPost, pin: canPinMessages, moderate: canModerateMessages } = permissions;
  const { toast } = useToast();
  // Previewed GIF links and GIF uploads, copied from the message's own menu.
  const gifUrls = message.isDeleted ? [] : messageGifUrls(message);
  const copyGifUrl = (url: string) => {
    void copyText(url).then(
      () => toast({ title: 'GIF URL copied' }),
      () => toast({ title: 'Could not copy the GIF URL', variant: 'destructive' }),
    );
  };
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
  const canAct = !isDeleted && !isSending && !isEditing;
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const replySwipeStart = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const [replySwipeOffset, setReplySwipeOffset] = useState(0);
  const [replySwipeSettling, setReplySwipeSettling] = useState(false);
  // Replies go to the channel composer, so they need a channel you can post in.
  const canReply = !compact && canPost;
  const canSwipeToReply = isTouchPrimary && canAct && canReply;
  // Swipe-to-reply is an enhancement, never the only route: the hover action bar
  // is pointer-only anyway, so touch-primary devices keep Reply in the hold
  // sheet, and pointers in the context menu, which keyboards also reach.
  const showReplyActionButton = canReply && !isTouchPrimary;
  const repliesToViewer =
    !!currentUserId &&
    (message.replyPreview?.author._id ?? replyTarget?.author._id) === currentUserId;
  // Discord-style: replies to you and mentions that reached you stand out.
  const pingsViewer =
    !isAuthor && !isDeleted && !isSending && (repliesToViewer || !!message.mentionsViewer);
  const doubleTapOption =
    QUICK_REACTIONS.find((reaction) => reaction.value === doubleTapReaction) ?? QUICK_REACTIONS[0];
  const doubleTapReacted = message.reactions.some(
    (reaction) => reaction.emoji === doubleTapOption.value && reaction.reactedByCurrentUser,
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
        setReactionBurst({ key: Date.now(), x: point.x - rect.left, y: point.y - rect.top });
      }
      hapticTick();
      // Like a double-tap like elsewhere: it adds, and never takes back.
      if (!doubleTapReacted && !isReactionPending) {
        onToggleReaction(message._id, doubleTapOption.value);
      }
    },
  });

  const resetReplySwipe = () => {
    replySwipeStart.current = null;
    setReplySwipeSettling(true);
    setReplySwipeOffset(0);
    requestAnimationFrame(() => setReplySwipeSettling(false));
  };

  const sheetActionGroups: MessageSheetAction[][] = [
    [
      ...(canReply
        ? [{ key: 'reply', label: 'Reply', icon: Reply, onSelect: () => onStartReply(message._id) }]
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
        ? [{ key: 'edit', label: 'Edit message', icon: Pencil, onSelect: () => onStartEdit(message._id) }]
        : []),
    ],
    [
      ...(hasBody
        ? [{ key: 'copy', label: 'Copy text', icon: Copy, onSelect: () => onCopyText(message) }]
        : []),
      // The hold sheet replaces the right-click menu on touch, GIF links included.
      ...gifUrls.map((url, index) => ({
        key: `gif-${url}`,
        label: gifUrls.length === 1 ? 'Copy GIF URL' : `Copy GIF ${index + 1} URL`,
        icon: Link2,
        onSelect: () => copyGifUrl(url),
      })),
      ...(canPinMessages && !compact
        ? [
            {
              key: 'pin',
              label: message.isPinned ? 'Unpin message' : 'Pin message',
              icon: message.isPinned ? PinOff : Pin,
              disabled: isPinPending,
              onSelect: () => onTogglePin(message._id, !message.isPinned),
            },
          ]
        : []),
      ...(!isAuthor
        ? [{ key: 'report', label: 'Report message', icon: Flag, onSelect: () => onReport?.(message._id) }]
        : []),
    ],
    isAuthor || canModerateMessages
      ? [
          {
            key: 'delete',
            label: 'Delete message',
            icon: Trash2,
            destructive: true,
            disabled: isDeletePending,
            onSelect: () => setDeleteDialogOpen(true),
          },
        ]
      : [],
  ];

  return (
    <>
    <ContextMenu>
      {/* Touch-first devices use the hold sheet below instead of this menu. */}
      <ContextMenuTrigger asChild disabled={!canAct || isTouchPrimary}>
        <div
          ref={rowRef}
          data-selected={actionSheetOpen ? '' : undefined}
          className={cn(
            'group/row relative touch-pan-y',
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
              // Touches inside a dialog opened from this row are not swipes on it.
              if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return;
              if (event.target.closest('button, a, input, textarea, [contenteditable=true], [data-message-gallery]')) return;
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
                hapticTick();
                onStartReply(message._id);
              }
              resetReplySwipe();
            }}
            onTouchCancel={resetReplySwipe}
          >
          <Message
            className={cn(
              'rounded-md gap-3 px-3 transition-colors duration-200 hover:bg-hover',
              // Pressed (set by the press handlers) and selected (sheet open).
              'group-data-[pressed]/row:bg-active group-data-[pressed]/row:duration-75 group-data-[selected]/row:bg-active',
              groupedWithPrevious ? 'py-0' : dense ? 'py-1.5' : 'py-2.5',
              pingsViewer &&
                'bg-amber-500/[0.09] hover:bg-amber-500/[0.13] before:pointer-events-none before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:rounded-full before:bg-amber-500',
              jumpedTo && 'bg-primary/10 ring-1 ring-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
              pingsViewer &&
                'group-data-[pressed]/row:bg-amber-500/[0.18] group-data-[selected]/row:bg-amber-500/[0.18]',
              isSending &&
                'animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
            )}
          >
      <MessageAvatar
        className={cn(
          'self-start overflow-visible bg-transparent',
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
        ) : null}
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
            {/* Touch devices use the hold sheet: on a phone a tap leaves
                this bar stuck open, and its hidden buttons caught taps. */}
            {!isDeleted && !isSending && !isTouchPrimary ? (
              <>
                <MessageActions
                  className={cn(
                    'pointer-events-none translate-y-1 rounded-lg border bg-popover p-0.5 opacity-0 shadow-md transition-[opacity,transform] duration-150 motion-reduce:transition-none group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-y-0 group-focus-within/message:opacity-100',
                    (reactionPickerOpen || actionsMenuOpen || deleteDialogOpen) &&
                      'pointer-events-auto translate-y-0 opacity-100',
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
                  {!compact && !isTouchPrimary ? (
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
          {hasBody ? (
            <ContextMenuItem onSelect={() => onCopyText(message)}>
              <Copy />
              Copy text
            </ContextMenuItem>
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
          {gifUrls.length === 1 ? (
            <ContextMenuItem onSelect={() => copyGifUrl(gifUrls[0]!)}>
              <Link2 />
              Copy GIF URL
            </ContextMenuItem>
          ) : gifUrls.length > 1 ? (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Link2 />
                Copy GIF URL
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-36">
                <ContextMenuGroup>
                  {gifUrls.map((url, index) => (
                    <ContextMenuItem key={url} onSelect={() => copyGifUrl(url)}>
                      GIF {index + 1}
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>
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
    {isTouchPrimary ? (
      <MessageActionSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        preview={{
          avatar: <ClubAvatar person={message.author} className="size-9" fallbackClassName="text-[11px]" />,
          authorName: fullName(message.author),
          sentAt: formatSheetTimestamp(message.createdAt),
          text: message.body.trim()
            ? message.body
            : message.poll
              ? `Poll: ${message.poll.question}`
              : message.attachments.length > 0
                ? `${message.attachments.length} ${message.attachments.length === 1 ? 'attachment' : 'attachments'}`
                : '',
        }}
        reactions={QUICK_REACTIONS.map((reaction) => ({
          value: reaction.value,
          label: reaction.label,
          name: reaction.name,
          selected: message.reactions.some(
            (existing) => existing.emoji === reaction.value && existing.reactedByCurrentUser,
          ),
        }))}
        doubleTap={{
          value: doubleTapOption.value,
          onChange: (value) => {
            if (isChannelReaction(value)) onChangeDoubleTapReaction(value);
          },
        }}
        onReact={(value) => {
          if (isChannelReaction(value)) onToggleReaction(message._id, value);
        }}
        actionGroups={sheetActionGroups}
      />
    ) : null}
    {/* Outside the row, so touches in the dialog never reach the row's gestures. */}
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
    </>
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The view lives in the URL so audit links and shares can open the board.
  const whiteboardRequested = searchParams?.get('view') === 'whiteboard';
  const setChannelView = (view: 'chat' | 'whiteboard') => {
    const next = new URLSearchParams(searchParams?.toString());
    next.delete('board');
    if (view === 'whiteboard') next.set('view', 'whiteboard');
    else next.delete('view');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : (pathname ?? ''), { scroll: false });
  };

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
  const rootComposerRef = useRef<ChannelMessageComposerHandle>(null);
  const [imageViewer, setImageViewer] = useState<(ImageViewerRequest & { open: boolean }) | null>(null);

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
    setImageViewer(null);
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
  // Clubs can turn whiteboards off; a stale whiteboard link then shows chat.
  const whiteboardsEnabled = conversationContext?.whiteboardsEnabled ?? false;
  const showWhiteboard = whiteboardRequested && whiteboardsEnabled;
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
  const unreadBoundary = useChannelUnreadBoundary(
    channelId + ':' + (user?._id ?? ''),
    user && conversationContext ? conversationContext.lastReadAt : undefined,
    messagePageStatus === 'LoadingFirstPage' ? undefined : messages,
  );
  // Fetch enough history to locate the saved boundary when more than one page
  // arrived during the user's absence. The scroller preserves prepend position.
  useEffect(() => {
    if (
      unreadBoundary &&
      unreadBoundary.lastReadAt > 0 &&
      messages.length > 0 &&
      new Date(messages[0].createdAt).getTime() > unreadBoundary.lastReadAt &&
      messagePageStatus === 'CanLoadMore'
    ) {
      loadMoreMessages(50);
    }
  }, [loadMoreMessages, messagePageStatus, messages, unreadBoundary]);
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
  const updateDoubleTapReaction = useMutation(
    api.users.me.updateChatDoubleTapReaction,
  ).withOptimisticUpdate((localStore, args) => {
    const me = localStore.getQuery(api.users.me.me, {});
    if (me) localStore.setQuery(api.users.me.me, {}, { ...me, chatDoubleTapReaction: args.reaction });
  });
  const doubleTapReaction =
    user?.chatDoubleTapReaction && isChannelReaction(user.chatDoubleTapReaction)
      ? user.chatDoubleTapReaction
      : DEFAULT_DOUBLE_TAP_REACTION;
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
    // Messages only count as read while the chat is on screen, not while the
    // channel's Whiteboards tab covers it.
    if (!latestVisibleActivity || !unreadBoundary || showWhiteboard) return;

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
  }, [channelId, latestVisibleActivity, markChannelRead, showWhiteboard, unreadBoundary]);

  const [savingEditId, setSavingEditId] = useState<Id<'clubChannelMessages'> | null>(null);

  const saveEdit = async (
    messageId: Id<'clubChannelMessages'>,
    { body, bodyMarkdown, bodyRich, files, removedAttachmentIds }: {
      body: string;
      bodyMarkdown: string;
      bodyRich: ClubChannelMessageRichBody | null;
      files: File[];
      removedAttachmentIds: string[];
    },
  ) => {
    const stagedIds: Id<'clubChannelAttachmentUploads'>[] = [];
    setSavingEditId(messageId);
    try {
      const uploads = await Promise.allSettled(
        files.map(async (file) => {
          const { storageId, uploadIntentId } = await uploadFileToConvex(
            { generateUploadUrl: () => generateUploadUrl({ purpose: 'CHAT_ATTACHMENT' }) },
            file,
          );
          return finalizeChatAttachment({ uploadIntentId, storageId, fileName: file.name });
        }),
      );
      stagedIds.push(
        ...uploads.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value.attachmentUploadId] : [],
        ),
      );
      const failed = uploads.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (failed) throw failed.reason;
      await updateMessage({
        messageId,
        body,
        bodyMarkdown: bodyMarkdown.trim() || undefined,
        bodyRich: bodyRich ?? undefined,
        addAttachments: stagedIds.length ? stagedIds : undefined,
        removeAttachmentIds: removedAttachmentIds.length
          ? (removedAttachmentIds as Id<'clubChannelMessageAttachments'>[])
          : undefined,
      });
      setEditingMessageId(null);
    } catch {
      await Promise.allSettled(
        stagedIds.map((attachmentUploadId) => discardChatAttachment({ attachmentUploadId })),
      );
      toast({ title: "Couldn't save your changes", variant: 'destructive' });
    } finally {
      setSavingEditId(null);
    }
  };

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

  const firstUnreadMessageId = normalizedSearch
    ? null
    : firstUnreadChannelMessageId(timelineMessages, unreadBoundary);

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

  const openImageViewer = useCallback(
    (request: ImageViewerRequest) => setImageViewer({ ...request, open: true }),
    [],
  );

  const copyMessageText = (message: ClubChannelMessage) => {
    copyText(message.body).then(
      () => toast({ title: 'Copied to clipboard' }),
      () => toast({ title: "Couldn't copy the message", variant: 'destructive' }),
    );
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
            // Synchronous, inside the tap or swipe, so iOS raises the keyboard.
            rootComposerRef.current?.focus();
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
          onCopyText={copyMessageText}
          doubleTapReaction={doubleTapReaction}
          onChangeDoubleTapReaction={(reaction) =>
            void updateDoubleTapReaction({ reaction }).catch(() =>
              toast({ title: "Couldn't save your double-tap reaction", variant: 'destructive' }),
            )
          }
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
          permissions={{
            post: channel?.viewerCanPost ?? true,
            pin: canPinMessages,
            moderate: canModerateMessages,
          }}
          openReactionDetailsOnPress={isMobile || isTouchPrimary}
          compact={compact}
          groupedWithPrevious={groupedWithPrevious}
        />
        {isEditing && (
          // Editable even inside the touch timeline, which turns selection off.
          <div className="ml-12 mr-3 mt-1 select-text">
            <ChannelMessageComposer
              key={`edit-${message._id}`}
              suggestionEntries={suggestionEntries}
              placeholder="Edit message..."
              submitLabel="Save Changes"
              isPending={savingEditId === message._id}
              canAttach
              existingAttachments={message.attachments}
              onMentionIntent={() => setMentionContextRequested(true)}
              initialBody={message.body}
              initialBodyMarkdown={message.bodyMarkdown}
              initialBodyRich={
                Array.isArray(message.bodyRich)
                  ? (message.bodyRich as ClubChannelMessageRichBody)
                  : null
              }
              onSubmit={(args) => void saveEdit(message._id, args)}
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
      <div className="flex shrink-0 items-center justify-between border-b py-2 pl-3 pr-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thread
          </p>
          <p className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <span className="truncate">{fullName(selectedThread.author)}</span>
            <DeveloperBadge user={selectedThread.author} size={13} />
            <BugHunterTag user={selectedThread.author} />
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
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
        scrollEdgeThreshold={CHAT_SCROLL_EDGE_THRESHOLD}
      >
        <MessageScroller className={cn('min-h-0 flex-1', isTouchPrimary && TOUCH_TIMELINE_CLASS)}>
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
          <MessageScrollerButton className={CHAT_SCROLL_BUTTON_CLASS} />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className={cn("channel-thread-dock shrink-0 border-t bg-card p-2", CARD_SURFACE_FOREGROUND)}>
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
    <ImageViewerContext.Provider value={openImageViewer}>
    <ClubWorkspace
      title={title}
      rightPane={rightPane}
      resizableRightPane
      mobileRightPane={{
        title: 'Thread',
        onClose: () => setSelectedThreadId(null),
      }}
      contentClassName={cn("channel-chat-surface relative flex h-full min-h-0 flex-col bg-card", CARD_SURFACE_FOREGROUND)}
      scrollOwner="content"
      channelSearch={{
        channelName: channel.name,
        value: search,
        onValueChange: setSearch,
      }}
    >
      <MessageScrollerProvider
        autoScroll
        defaultScrollPosition="end"
        scrollEdgeThreshold={CHAT_SCROLL_EDGE_THRESHOLD}
      >
        <ScrollToReplyTarget
          messageId={jumpedToMessageId}
          requestKey={jumpRequestKey}
          targetPresent={timelineMessages.some((message) => message._id === jumpedToMessageId)}
        />
        <div className={cn("channel-context-toolbar shrink-0 border-b bg-card px-2 py-1.5", CARD_SURFACE_FOREGROUND)}>
          <div className="mx-auto flex w-full max-w-4xl items-center gap-1">
            {whiteboardsEnabled ? (
              <TabsSubtle
                selectedIndex={showWhiteboard ? 1 : 0}
                onSelect={(index) => setChannelView(index === 1 ? 'whiteboard' : 'chat')}
                className="mr-1"
              >
                <TabsSubtleItem index={0} label="Chat" className="py-1" />
                <TabsSubtleItem index={1} label="Whiteboards" className="py-1" />
              </TabsSubtle>
            ) : null}
            <ChannelNotificationSettings
              key={channelId}
              clubId={clubId}
              channelId={channelId}
              channelName={channel.name}
            />
            {showWhiteboard ? null : (
              <PinnedMessagesButton
                messages={pinnedMessages}
                onClearSearch={() => setSearch('')}
              />
            )}
          </div>
        </div>

        {showWhiteboard ? (
          <div className="min-h-0 flex-1">
            <ChannelWhiteboard key={channelId} channelId={channelId} channelName={channel.name} />
          </div>
        ) : (
        <MessageScroller className={cn('min-h-0 flex-1', isTouchPrimary && TOUCH_TIMELINE_CLASS)}>
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
                    {message._id === firstUnreadMessageId && (
                      <Marker
                        variant="separator"
                        role="separator"
                        aria-label="Unread messages"
                        className="my-2 text-destructive before:bg-destructive after:bg-destructive"
                      >
                        <MarkerContent>Unread</MarkerContent>
                      </Marker>
                    )}
                    {renderMessageRow(
                      message,
                      false,
                      message._id !== firstUnreadMessageId && shouldGroupMessages(visibleMessages[index - 1], message),
                    )}
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
          <MessageScrollerButton className={CHAT_SCROLL_BUTTON_CLASS} />
        </MessageScroller>
        )}
      </MessageScrollerProvider>

      {showWhiteboard ? null : (
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
                handleRef={rootComposerRef}
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
      )}
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
    {imageViewer ? (
      <ImageViewer
        images={imageViewer.images}
        index={imageViewer.index}
        open={imageViewer.open}
        onClose={() => setImageViewer((current) => current && { ...current, open: false })}
      />
    ) : null}
    </ImageViewerContext.Provider>
        );
        }

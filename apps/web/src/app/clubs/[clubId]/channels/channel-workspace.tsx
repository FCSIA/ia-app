'use client';

import { displayName, nameSearchValues } from '~/apps/shared/user-name';

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { format, isSameDay } from 'date-fns';
import { formatMessageTime } from '@/lib/message-time';

import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from '@/lib/convex-react';
import {
  BarChart3,
  Copy,
  FileText,
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
  Search,
  ArrowDown,
  CircleAlert,
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
  DropdownContent,
  DropdownTrigger,
  DropdownSeparator,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import {
  ReactionPicker,
  ReactionToggle,
} from '@/components/clubs/reaction-picker';
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
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { ChannelWhiteboard } from '@/components/clubs/whiteboard/channel-whiteboard';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { AppRole } from '~/apps/convex/lib/roles';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import { hapticTick } from '@/lib/haptics';
import { useMessagePress } from '@/components/clubs/use-message-press';
import {
  MessageActionSheet,
  type MessageSheetAction,
} from '@/components/clubs/message-action-sheet';
import type { ViewerImage } from '@/components/media/image-viewer';
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
import { ClubChannelVisibilityIcon } from '@/components/clubs/channel-visibility';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubPersonAvatar } from '@/components/clubs/club-person-avatar';
import {
  PresenceAvatar,
  useMemberPresence,
} from '@/components/presence/club-presence';
import { PersonTrigger } from '@/components/users/person-trigger';
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
import { DeveloperBadge } from '@/components/ui/developer-badge';
import { Button } from '@/components/ui/button';
import { Card, CardGroup } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerVisibility,
  useMessageScrollerScrollable,
} from '@/components/ui/message-scroller';
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from '@/components/ui/message';

import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { ChatGifLinks } from '@/components/clubs/chat-gif';
import { AnimatedGif } from '@/components/media/animated-gif';
import { MediaPlaybackContext } from '@/hooks/use-media-visibility';
import { isGifAttachment, messageGifUrls } from '~/apps/shared/chat/gifs';
import { useCurrentUser } from '@/lib/auth';
import { ConvexError } from 'convex/values';
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
type FriendshipStatus =
  'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';

const MESSAGE_GROUP_WINDOW_MS = 7 * 60 * 1000;

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
  () =>
    import('@/components/media/image-viewer').then(
      (module) => module.ImageViewer,
    ),
  { ssr: false },
);

type ImageViewerRequest = { images: ViewerImage[]; index: number };

/**
 * Opens the channel's single image viewer. It lives outside the message rows,
 * so their gestures and context menu never see its events.
 */
const ImageViewerContext = createContext<(request: ImageViewerRequest) => void>(
  () => {},
);

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
    return <AnimatedGif key={href} src={href} name={attachment.fileName} />;
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
        <AttachmentDescription>
          {getAttachmentDescription(attachment)}
        </AttachmentDescription>
      </AttachmentContent>
      {isImage && onOpenImage ? (
        <AttachmentTrigger
          aria-label={`View ${attachment.fileName}`}
          onClick={onOpenImage}
        />
      ) : (
        <AttachmentTrigger
          asChild
          aria-label={`Open ${attachment.fileName} in a new tab`}
        >
          <a href={href} target="_blank" rel="noreferrer" />
        </AttachmentTrigger>
      )}
    </Attachment>
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: ClubChannelMessageAttachment[];
}) {
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
        <MessageAttachmentCard
          attachment={attachments[0]}
          onOpenImage={openImage(attachments[0])}
        />
      </AttachmentGroup>
    );
  }

  return (
    <MessageAttachmentGallery attachments={attachments} openImage={openImage} />
  );
}

function MessageAttachmentGallery({
  attachments,
  openImage,
}: {
  attachments: ClubChannelMessageAttachment[];
  openImage: (
    attachment: ClubChannelMessageAttachment,
  ) => (() => void) | undefined;
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
        className="max-w-[75ch]"
      />
      <ChatGifLinks text={message.bodyMarkdown || message.body} />
    </>
  );
}

function PinnedMessagesButton({
  messages,
  onJump,
  hasMore = false,
}: {
  messages: ClubChannelMessage[];
  onJump: (messageId: string) => void;
  hasMore?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const jumpToMessage = (messageId: string) => {
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
                const preview =
                  message.poll?.question ||
                  message.body ||
                  message.attachments[0]?.fileName ||
                  'Attachment';
                return (
                  <Card
                    key={message._id}
                    label={`Jump to pinned message by ${fullName(message.author)}`}
                    className="gap-3 px-3 py-3"
                    onClick={() => jumpToMessage(message._id)}
                  >
                    <ClubPersonAvatar
                      person={message.author}
                      className="size-7 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">
                          {fullName(message.author)}
                        </span>
                        <DeveloperBadge user={message.author} size={13} />
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">
                        {preview}
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

function ChannelSearch({
  clubId,
  channelId,
  channelName,
  onJump,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  channelName: string;
  onJump: (messageId: string, threadId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim());
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
                {results.length === 30 ? '+' : ''}{' '}
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
                  <ClubPersonAvatar
                    person={message.author}
                    className="size-7"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">
                      {fullName(message.author)} ·{' '}
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
  const presence = useMemberPresence(author._id);

  const trigger =
    triggerVariant === 'name' ? (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className="inline-flex min-w-0 items-center gap-1 rounded-sm py-0.5 text-[13px] font-semibold text-foreground outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="truncate">{name}</span>
        <DeveloperBadge user={author} size={13} />
      </button>
    ) : (
      <button
        type="button"
        aria-label={`View ${name} profile`}
        className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <PresenceAvatar status={presence}>
          <ClubPersonAvatar
            person={author}
            className={compact ? 'size-7' : 'size-9'}
            fallbackClassName={compact ? 'text-[10px]' : 'text-[11px]'}
          />
        </PresenceAvatar>
      </button>
    );

  return (
    <PersonTrigger
      person={author}
      roleName={author.clubRole?.name}
      trigger={trigger}
      actions={
        canSendFriendRequest &&
        !isCurrentUser &&
        hasStudentScheduleRole(author.roles) ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={
              isPending || (!!friendshipStatus && friendshipStatus !== 'NONE')
            }
            onClick={() => onSendFriendRequest(author._id)}
          >
            {isPending
              ? 'Sending…'
              : friendshipStatus === 'FRIENDS'
                ? 'Friends'
                : friendshipStatus === 'REQUEST_SENT'
                  ? 'Request sent'
                  : friendshipStatus === 'REQUEST_RECEIVED'
                    ? 'Request received'
                    : 'Add friend'}
          </Button>
        ) : undefined
      }
    />
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
                <span className="text-xs text-muted-foreground">
                  {option.count} · {percent}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  author: Parameters<typeof ClubPersonAvatar>[0]['person'];
  grouped: boolean;
  payload: Pick<
    ComposerSubmitArgs,
    'body' | 'bodyMarkdown' | 'bodyRich' | 'files' | 'pollQuestion'
  >;
  reason: string;
  retrying: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <Message grouped={grouped} className="gap-3 rounded-md px-3">
      <MessageAvatar>
        {grouped ? null : (
          <ClubPersonAvatar
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
              {fullName(author)}
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

/** "You, Mary Jones and 2 others reacted with 👍" — the viewer is always "You". */
function describeReactors({
  count,
  label,
  viewerReacted,
  names,
}: {
  count: number;
  label: string;
  viewerReacted: boolean;
  names: string[];
}) {
  const shown = [...(viewerReacted ? ['You'] : []), ...names].slice(0, 3);
  if (shown.length === 0)
    return `${count} ${count === 1 ? 'person' : 'people'} reacted with ${label}`;
  const remaining = Math.max(0, count - shown.length);
  const parts = remaining
    ? [...shown, `${remaining} ${remaining === 1 ? 'other' : 'others'}`]
    : shown;
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${list} reacted with ${label}`;
}

function ReactionButton({
  clubId,
  channelId,
  messageId,
  reaction,
  onToggleReaction,
  isReactionPending,
  openDetailsOnPress,
  currentUserId,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  messageId: string;
  reaction: ClubChannelMessage['reactions'][number];
  onToggleReaction: (messageId: string, emoji: ChannelReaction) => void;
  isReactionPending: boolean;
  openDetailsOnPress: boolean;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    [],
  );
  const {
    results: reactors,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.clubs.channels.listReactionUsers,
    open || hovered
      ? {
          clubId,
          channelId,
          messageId: messageId as Id<'clubChannelMessages'>,
          emoji: reaction.emoji,
        }
      : 'skip',
    { initialNumItems: 25 },
  );
  const label = REACTION_LABELS[reaction.emoji] ?? reaction.emoji;
  const description = describeReactors({
    count: reaction.count,
    label,
    viewerReacted: reaction.reactedByCurrentUser,
    names: reactors
      .filter((person) => person._id !== currentUserId)
      .map(fullName),
  });
  const chip = (
    <ReactionToggle
      kind="chip"
      pressed={reaction.reactedByCurrentUser}
      disabled={isReactionPending}
      aria-label={`${label}, ${reaction.count} reactions${reaction.reactedByCurrentUser ? ', you reacted' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onTouchStart={(event) => {
        held.current = false;
        const touch = event.touches[0];
        touchStart.current = touch
          ? { x: touch.clientX, y: touch.clientY }
          : null;
        cancelHold();
        holdTimer.current = setTimeout(() => {
          held.current = true;
          hapticTick();
          setOpen(true);
        }, 420);
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        const start = touchStart.current;
        if (
          !touch ||
          !start ||
          Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8
        )
          cancelHold();
      }}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
      onContextMenu={(event) => {
        if (openDetailsOnPress) event.preventDefault();
      }}
      onClick={(event) => {
        event.preventDefault();
        if (held.current) {
          held.current = false;
          return;
        }
        if (isChannelReaction(reaction.emoji)) {
          hapticTick();
          onToggleReaction(messageId, reaction.emoji);
        }
      }}
    >
      <span>{label}</span>
      <span className="tabular-nums">{reaction.count}</span>
    </ReactionToggle>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="inline-flex"
          onClick={(event) => event.preventDefault()}
        >
          {/* Beside the chip, not above it: above covers the message's last line. */}
          <Tooltip content={description} side="right">
            {chip}
          </Tooltip>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-64 p-3"
        aria-label={`People who reacted with ${label}`}
      >
        <p className="mb-2 text-sm font-medium">Reacted with {label}</p>
        {status === 'LoadingFirstPage' ? (
          <p className="text-sm text-muted-foreground">Loading people…</p>
        ) : (
          reactors.map((person) => (
            <p key={person._id} className="py-1 text-sm">
              {fullName(person)}
            </p>
          ))
        )}
        {status === 'CanLoadMore' ? (
          <Button variant="ghost" size="sm" onClick={() => loadMore(25)}>
            Show more
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
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

function HistoryPagination({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (count: number) => void;
}) {
  const { visibleMessageIds } = useMessageScrollerVisibility();
  useEffect(() => {
    if (status === 'CanLoadMore' && visibleMessageIds.includes('history-start'))
      loadMore(40);
  }, [visibleMessageIds, status, loadMore]);
  return null;
}

function NewMessagesButton({
  messages,
  viewerId,
}: {
  messages: ClubChannelMessage[];
  viewerId?: string;
}) {
  const { end: scrolledUp } = useMessageScrollerScrollable();
  const [newCount, setNewCount] = useState(0);
  const newestSeenAt = useRef<number | null>(null);
  useEffect(() => {
    const newest = Math.max(
      0,
      ...messages
        .filter((message) => !('deliveryState' in message))
        .map((message) => new Date(message.createdAt).getTime()),
    );
    if (newestSeenAt.current !== null && scrolledUp)
      setNewCount(
        messages.filter(
          (message) =>
            !('deliveryState' in message) &&
            message.authorId !== viewerId &&
            new Date(message.createdAt).getTime() > newestSeenAt.current!,
        ).length,
      );
    else {
      newestSeenAt.current = newest;
      setNewCount(0);
    }
  }, [messages, viewerId, scrolledUp]);
  return (
    <MessageScrollerButton
      className={CHAT_SCROLL_BUTTON_CLASS}
      size={newCount ? 'sm' : 'icon-sm'}
    >
      <ArrowDown />
      {newCount ? (
        `${newCount} new`
      ) : (
        <span className="sr-only">Jump to latest</span>
      )}
    </MessageScrollerButton>
  );
}

function TypingPresence({
  clubId,
  channelId,
  active,
}: {
  clubId: Id<'clubs'>;
  channelId: Id<'clubChannels'>;
  active: boolean;
}) {
  const heartbeat = useMutation(api.clubs.channels.typingHeartbeat);
  const disconnect = useMutation(api.presence.status.disconnect);
  const people = useQuery(api.clubs.channels.typingUsers, {
    clubId,
    channelId,
  });
  useEffect(() => {
    if (!active) return;
    const sessionId = crypto.randomUUID();
    let stopped = false;
    let token: string | null = null;
    const ping = () => {
      void heartbeat({ clubId, channelId, sessionId })
        .then((result) => {
          if (stopped) void disconnect(result);
          else token = result.sessionToken;
        })
        .catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 2_000);
    return () => {
      stopped = true;
      clearInterval(timer);
      if (token) void disconnect({ sessionToken: token }).catch(() => {});
    };
  }, [active, clubId, channelId, heartbeat, disconnect]);
  if (!people?.length) return null;
  return (
    <p className="px-3 pb-1 text-xs text-muted-foreground" aria-live="polite">
      {people
        .slice(0, 2)
        .map((person) => person.name)
        .join(' and ')}
      {people.length > 2
        ? ' and others are'
        : people.length === 1
          ? ' is'
          : ' are'}{' '}
      typing…
    </p>
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
    if (
      !messageId ||
      !targetPresent ||
      lastScrolledRequestKey.current === requestKey
    )
      return;

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
        <ClubPersonAvatar
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
  replying,
  editor,
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
  replying: boolean;
  editor?: ReactNode;
  jumpedTo: boolean;
  permissions: MessagePermissions;
  currentUserId?: string;
  openReactionDetailsOnPress: boolean;
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
    swiping: boolean;
  } | null>(null);
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
      try {
        localStorage.setItem('chat-double-tap-learned', 'true');
      } catch {}
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
              disabled: isPinPending,
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
            disabled: isDeletePending,
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
                replySwipeOffset
                  ? 'translate-x-0 opacity-100'
                  : 'translate-x-1 opacity-0',
              )}
            >
              <Reply className="size-4" />
            </div>
            <div
              className={cn(
                'relative will-change-transform',
                replySwipeSettling &&
                  'transition-transform duration-200 ease-out motion-reduce:transition-none',
              )}
              style={
                replySwipeOffset
                  ? { transform: `translateX(${replySwipeOffset}px)` }
                  : undefined
              }
              onTouchStart={(event) => {
                if (!canSwipeToReply || event.touches.length !== 1) return;
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
                  swiping: false,
                };
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
                grouped={groupedWithPrevious}
                data-replying={replying || undefined}
                className={cn(
                  'rounded-md gap-3 px-3 transition-colors duration-200 hover:bg-hover',
                  // Pressed (set by the press handlers) and selected (sheet open).
                  'group-data-[pressed]/row:bg-active group-data-[pressed]/row:duration-75 group-data-[selected]/row:bg-active',
                  pingsViewer &&
                    'bg-[hsl(var(--mention-surface))] shadow-[inset_2px_0_0_hsl(var(--mention))]',
                  jumpedTo &&
                    'bg-primary/10 ring-1 ring-primary/25 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                  replying &&
                    'bg-primary/5 shadow-[inset_2px_0_0_hsl(var(--primary))]',
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
                  ) : (
                    <time
                      dateTime={message.createdAt}
                      className="block pt-0.5 text-center text-[11px] tabular-nums text-muted-foreground opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-coarse:opacity-100"
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
                      {message.author.clubRole ? (
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
                            isPending={isVotePending}
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
                              isReactionPending={isReactionPending}
                              openDetailsOnPress={openReactionDetailsOnPress}
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
                              'pointer-events-none translate-y-1 rounded-xl bg-surface-3 p-0.5 opacity-0 shadow-surface-3 transition-[opacity,transform] duration-150 motion-reduce:transition-none group-hover/message:pointer-events-auto group-hover/message:translate-y-0 group-hover/message:opacity-100 group-focus-within/message:pointer-events-auto group-focus-within/message:translate-y-0 group-focus-within/message:opacity-100',
                              (reactionPickerOpen ||
                                actionsMenuOpen ||
                                deleteDialogOpen) &&
                                'pointer-events-auto translate-y-0 opacity-100',
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
                                    disabled={isReactionPending}
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
                                  disabled={isReactionPending}
                                  onPick={(value, keepOpen) => {
                                    if (isChannelReaction(value))
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
                disabled={isReactionPending}
                onPick={(value, keepOpen) => {
                  if (isChannelReaction(value))
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
              <ClubPersonAvatar
                person={message.author}
                className="size-9"
                fallbackClassName="text-[11px]"
              />
            ),
            authorName: fullName(message.author),
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
            <div className="my-2 flex gap-3 rounded-lg bg-muted/60 p-3">
              <ClubPersonAvatar person={message.author} className="size-9" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {fullName(message.author)}
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

export function ChannelWorkspace() {
  const params = useParams<{ channelId: string }>();
  const channelIdParam = params?.channelId;
  if (!channelIdParam) {
    throw new Error('Channel workspace requires a channel route parameter.');
  }
  const clubId = useClubId();
  const channelId = useRouteChannelId(channelIdParam);
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
    router.replace(query ? `${pathname}?${query}` : (pathname ?? ''), {
      scroll: false,
    });
  };

  const [editingMessageId, setEditingMessageId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [selectedThreadId, setSelectedThreadId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [replyingToMessageId, setReplyingToMessageId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [jumpedToMessageId, setJumpedToMessageId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [jumpRequestKey, setJumpRequestKey] = useState(0);
  const [reportingMessageId, setReportingMessageId] =
    useState<Id<'clubChannelMessages'> | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [friendRequestPendingId, setFriendRequestPendingId] = useState<
    string | null
  >(null);
  const [sendingMode, setSendingMode] = useState<'root' | 'thread' | null>(
    null,
  );
  const [mentionContextRequested, setMentionContextRequested] = useState(false);
  const [typingActive, setTypingActive] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTypingActivity = useCallback((hasText: boolean) => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    setTypingActive(hasText);
    if (hasText)
      typingTimeout.current = setTimeout(() => setTypingActive(false), 4_000);
  }, []);
  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    },
    [],
  );
  const rootComposerRef = useRef<ChannelMessageComposerHandle>(null);
  const replyComposerRef = useRef<ChannelMessageComposerHandle>(null);
  const [failedSends, setFailedSends] = useState<
    Array<{
      channelId: Id<'clubChannels'>;
      payload: ComposerSubmitArgs;
      identity: ReturnType<typeof createClientMessageIdentity>;
      reason: string;
      retrying: boolean;
    }>
  >([]);
  const [imageViewer, setImageViewer] = useState<
    (ImageViewerRequest & { open: boolean }) | null
  >(null);

  // The workspace is intentionally persistent across channel navigation. Clear
  // state that belongs to the previous conversation without remounting the
  // navigation, panel layout, or outer composer surface.
  useEffect(() => {
    setTypingActive(false);
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
    setImageViewer(null);
  }, [channelId]);

  const user = useCurrentUser();

  const conversationContext = useQuery(
    api.clubs.channels.getConversationContext,
    {
      clubId,
      channelId,
    },
  );
  const pinnedResult = useQuery(api.clubs.channels.listPinned, {
    clubId,
    channelId,
  });
  const linkedMessageId = searchParams?.get('message');
  useEffect(() => {
    if (linkedMessageId) {
      setJumpedToMessageId(linkedMessageId as Id<'clubChannelMessages'>);
      setJumpRequestKey((key) => key + 1);
    }
  }, [channelId, linkedMessageId]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (replyingToMessageId) setReplyingToMessageId(null);
      else if (editingMessageId) setEditingMessageId(null);
      else setSelectedThreadId(null);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [replyingToMessageId, editingMessageId]);
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
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
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
    jumpedToMessageId
      ? { clubId, channelId, messageId: jumpedToMessageId }
      : 'skip',
  );
  useEffect(() => {
    if (jumpedToMessage?.parentMessageId)
      setSelectedThreadId(jumpedToMessage.threadRootId);
  }, [jumpedToMessage]);
  const selectedThreadResult = useQuery(
    api.clubs.channels.getThread,
    selectedThreadId
      ? { clubId, channelId, messageId: selectedThreadId }
      : 'skip',
  );

  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const markChannelRead = useMutation(api.clubs.channels.markRead);
  const finalizeChatAttachment = useAction(
    api.uploads.files.finalizeChatAttachment,
  );
  const discardChatAttachment = useMutation(
    api.uploads.files.discardChatAttachment,
  );
  const postMessage = useMutation(
    api.clubs.channels.postMessage,
  ).withOptimisticUpdate((localStore, args) => {
    if (!user) return;
    optimisticallyInsertPostedMessage(localStore, args, {
      clubId,
      author: user,
    });
  });
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(
    api.clubs.channels.toggleReaction,
  ).withOptimisticUpdate((localStore, args) => {
    if (!user) return;
    optimisticallyToggleMessageReaction(localStore, args, {
      clubId,
      channelId,
      currentUserId: user._id,
      threadId: selectedThreadId,
    });
  });
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const updateDoubleTapReaction = useMutation(
    api.users.me.updateChatDoubleTapReaction,
  ).withOptimisticUpdate((localStore, args) => {
    const me = localStore.getQuery(api.users.me.me, {});
    if (me)
      localStore.setQuery(
        api.users.me.me,
        {},
        { ...me, chatDoubleTapReaction: args.reaction },
      );
  });
  const doubleTapReaction =
    user?.chatDoubleTapReaction && isChannelReaction(user.chatDoubleTapReaction)
      ? user.chatDoubleTapReaction
      : DEFAULT_DOUBLE_TAP_REACTION;
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const submitReport = useMutation(
    api.moderation.reports.submitClubChannelMessage,
  );
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
      if (latestVisibleActivity.occurredAt <= lastMarkedActivityRef.current)
        return;

      const previousActivity = lastMarkedActivityRef.current;
      lastMarkedActivityRef.current = latestVisibleActivity.occurredAt;
      lastReadAttemptAtRef.current = Date.now();
      void markChannelRead({
        channelId,
        throughMessageId:
          latestVisibleActivity.messageId as Id<'clubChannelMessages'>,
      })
        .then(() =>
          dismissReadChannelWebNotifications(
            channelId,
            latestVisibleActivity.occurredAt,
          ),
        )
        .catch(() => {
          if (
            lastMarkedActivityRef.current === latestVisibleActivity.occurredAt
          ) {
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
  }, [
    channelId,
    latestVisibleActivity,
    markChannelRead,
    showWhiteboard,
    unreadBoundary,
  ]);

  const [savingEditId, setSavingEditId] =
    useState<Id<'clubChannelMessages'> | null>(null);

  const saveEdit = async (
    messageId: Id<'clubChannelMessages'>,
    {
      body,
      bodyMarkdown,
      bodyRich,
      files,
      removedAttachmentIds,
    }: {
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
            {
              generateUploadUrl: () =>
                generateUploadUrl({ purpose: 'CHAT_ATTACHMENT' }),
            },
            file,
          );
          return finalizeChatAttachment({
            uploadIntentId,
            storageId,
            fileName: file.name,
          });
        }),
      );
      stagedIds.push(
        ...uploads.flatMap((result) =>
          result.status === 'fulfilled'
            ? [result.value.attachmentUploadId]
            : [],
        ),
      );
      const failed = uploads.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
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
        stagedIds.map((attachmentUploadId) =>
          discardChatAttachment({ attachmentUploadId }),
        ),
      );
      toast({ title: "Couldn't save your changes", variant: 'destructive' });
    } finally {
      setSavingEditId(null);
    }
  };

  const submitMessage = async (
    payload: ComposerSubmitArgs,
    retryIdentity?: ReturnType<typeof createClientMessageIdentity>,
  ) => {
    const {
      body,
      bodyMarkdown,
      bodyRich,
      parentMessageId,
      replyToMessageId,
      files,
      pollQuestion,
      pollOptions,
      mode,
    } = payload;
    const identity = retryIdentity ?? createClientMessageIdentity();
    const destinationChannelId = channelId;
    const attachmentUploadIds: Id<'clubChannelAttachmentUploads'>[] = [];
    if (!retryIdentity) {
      (mode === 'thread' ? replyComposerRef : rootComposerRef).current?.clear();
      if (mode === 'root') setReplyingToMessageId(null);
    }
    setFailedSends((current) =>
      current.map((item) =>
        item.identity.clientGeneratedId === identity.clientGeneratedId
          ? { ...item, retrying: true }
          : item,
      ),
    );
    if (files.length) setSendingMode(mode);
    try {
      const uploads = await Promise.allSettled(
        files.map(async (file) => {
          const { storageId, uploadIntentId } = await uploadFileToConvex(
            {
              generateUploadUrl: () =>
                generateUploadUrl({ purpose: 'CHAT_ATTACHMENT' }),
            },
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
        ...uploads.flatMap((result) =>
          result.status === 'fulfilled'
            ? [result.value.attachmentUploadId]
            : [],
        ),
      );
      const failure = uploads.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (failure) throw failure.reason;
      if (files.length) setSendingMode(null);
      await postMessage({
        channelId: destinationChannelId,
        body: body.trim(),
        bodyMarkdown: bodyMarkdown.trim() || undefined,
        bodyRich: body.trim() ? (bodyRich ?? undefined) : undefined,
        parentMessageId: parentMessageId as
          Id<'clubChannelMessages'> | undefined,
        replyToMessageId: replyToMessageId as
          Id<'clubChannelMessages'> | undefined,
        pollQuestion,
        pollOptions,
        attachments: attachmentUploadIds,
        ...identity,
      });
      await Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardChatAttachment({ attachmentUploadId }),
        ),
      );
      setFailedSends((current) =>
        current.filter(
          (item) =>
            item.identity.clientGeneratedId !== identity.clientGeneratedId,
        ),
      );
    } catch (error) {
      await Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardChatAttachment({ attachmentUploadId }),
        ),
      );
      const reason =
        error instanceof ConvexError && typeof error.data === 'string'
          ? error.data
          : error instanceof Error
            ? error.message
            : 'Check your connection and try again.';
      setFailedSends((current) => [
        ...current.filter(
          (item) =>
            item.identity.clientGeneratedId !== identity.clientGeneratedId,
        ),
        {
          channelId: destinationChannelId,
          payload,
          identity,
          reason,
          retrying: false,
        },
      ]);
    } finally {
      if (files.length) setSendingMode(null);
    }
  };

  const renderFailedSends = (parentMessageId?: string) => {
    if (!user) return null;
    const items = failedSends.filter(
      (item) =>
        item.channelId === channelId &&
        item.payload.parentMessageId === parentMessageId,
    );
    if (items.length === 0) return null;
    // The first unsent row joins the viewer's run when the conversation
    // already ends with the viewer's own recent message.
    const delivered = parentMessageId ? threadReplies : timelineMessages;
    const last = delivered[delivered.length - 1];
    const joinsRun =
      !!last &&
      last.authorId === user._id &&
      !last.isDeleted &&
      Date.now() - new Date(last.createdAt).getTime() <=
        MESSAGE_GROUP_WINDOW_MS;
    // Retry and Discard unmount their own buttons; keep typing where it was.
    const refocusComposer = () =>
      (parentMessageId ? replyComposerRef : rootComposerRef).current?.focus();
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
          refocusComposer();
          void submitMessage(item.payload, item.identity);
        }}
        onDiscard={() => {
          refocusComposer();
          setFailedSends((current) =>
            current.filter((entry) => entry !== item),
          );
        }}
      />
    ));
  };

  const channel = conversationContext?.channel;
  const canPinMessages = conversationContext?.canPinMessages ?? false;
  const canModerateMessages = conversationContext?.canModerateMessages ?? false;

  const suggestionEntries = useMemo<ChannelMentionSuggestion[]>(() => {
    const canUseAll = !!mentionContext?.canMentionEveryone;
    const builtIns: ChannelMentionSuggestion[] = [
      ...(canUseAll
        ? [
            {
              token: 'all',
              label: 'Everyone',
              detail: '',
              kind: 'built-in' as const,
            },
          ]
        : []),
      { token: 'sponsors', label: 'Sponsors', detail: '', kind: 'built-in' },
    ];
    const tags =
      mentionContext?.tags.map((tag) => ({
        token: tag.slug,
        label: tag.name,
        detail: '',
        kind: 'tag' as const,
      })) ?? [];
    const groups =
      mentionContext?.groups.map((group) => ({
        token: group.token,
        label: group.label,
        detail: group.detail,
        kind: group.kind,
      })) ?? [];
    const people = (mentionContext?.members ?? []).map((person) => ({
      token: person.uniqueId,
      label: displayName(person),
      searchNames: nameSearchValues(person),
      detail: person.clubRole ?? '',
      avatarUrl: person.avatarUrl,
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
      jumpedToMessage &&
      !jumpedToMessage.parentMessageId &&
      !messages.some((message) => message._id === jumpedToMessage._id)
        ? [...messages, jumpedToMessage].sort(
            (left, right) =>
              new Date(left.createdAt).getTime() -
              new Date(right.createdAt).getTime(),
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
      [
        ...new Set(
          flattenedMessages
            .filter((message) => hasStudentScheduleRole(message.author.roles))
            .map((message) => message.author._id)
            .filter((userId) => userId !== user?._id),
        ),
      ].slice(0, 100),
    [flattenedMessages, user?._id],
  );
  const friendshipStatuses = useQuery(
    api.schedule.friends.getStatuses,
    hasStudentScheduleRole(user?.roles) && friendshipTargetIds.length > 0
      ? { userIds: friendshipTargetIds }
      : 'skip',
  );
  const friendshipStatusByUserId = useMemo(
    () =>
      new Map(
        friendshipStatuses?.map(({ userId, status }) => [userId, status]),
      ),
    [friendshipStatuses],
  );
  const messagesById = useMemo(
    () => new Map(flattenedMessages.map((message) => [message._id, message])),
    [flattenedMessages],
  );
  const replyingToMessage = replyingToMessageId
    ? (messagesById.get(replyingToMessageId) ?? null)
    : null;

  const visibleMessages = timelineMessages;
  const firstUnreadMessageId = firstUnreadChannelMessageId(
    timelineMessages,
    unreadBoundary,
    user?._id,
  );

  const reportingMessage = useMemo(
    () =>
      flattenedMessages.find((message) => message._id === reportingMessageId) ??
      null,
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
      () =>
        toast({ title: "Couldn't copy the message", variant: 'destructive' }),
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
        title:
          error instanceof Error
            ? error.message
            : 'Failed to send friend request',
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
            void deleteMessage({
              messageId: messageId as Id<'clubChannelMessages'>,
            }).then(() => toast({ title: 'Message deleted' }))
          }
          onReport={(messageId) =>
            setReportingMessageId(messageId as Id<'clubChannelMessages'>)
          }
          onCopyText={copyMessageText}
          doubleTapReaction={doubleTapReaction}
          onChangeDoubleTapReaction={(reaction) =>
            void updateDoubleTapReaction({ reaction }).catch(() =>
              toast({
                title: "Couldn't save your double-tap reaction",
                variant: 'destructive',
              }),
            )
          }
          canSendFriendRequest={hasStudentScheduleRole(user?.roles)}
          friendshipStatus={friendshipStatusByUserId.get(message.author._id)}
          onSendFriendRequest={(friendId) =>
            void handleSendFriendRequest(friendId)
          }
          editor={
            isEditing ? (
              <div className="select-text">
                {' '}
                <ChannelMessageComposer
                  key={`edit-${message._id}`}
                  mode="edit"
                  onCancel={() => {
                    setEditingMessageId(null);
                    (message.parentMessageId
                      ? replyComposerRef
                      : rootComposerRef
                    ).current?.focus();
                  }}
                  suggestionEntries={suggestionEntries}
                  placeholder="Edit message..."
                  submitLabel="Save changes"
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
              </div>
            ) : null
          }
          isEditing={isEditing}
          isReactionPending={false}
          isPinPending={false}
          isVotePending={false}
          isDeletePending={false}
          friendRequestPendingId={friendRequestPendingId}
          replying={replyingToMessageId === message._id}
          jumpedTo={jumpedToMessageId === message._id}
          permissions={{
            post: channel?.viewerCanPost ?? true,
            pin: canPinMessages,
            moderate: canModerateMessages,
          }}
          openReactionDetailsOnPress={isTouchPrimary}
          compact={compact}
          groupedWithPrevious={groupedWithPrevious}
        />
      </div>
    );
  };

  if (conversationContext === undefined) {
    return (
      <ClubWorkspace title={<Skeleton className="h-5 w-28" />}>
        <div className="space-y-5 p-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </ClubWorkspace>
    );
  }
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
  const pinnedMessages = pinnedResult?.messages ?? [];
  const jumpToMessage = (messageId: string, threadId?: string) => {
    setChannelView('chat');
    setJumpedToMessageId(messageId as Id<'clubChannelMessages'>);
    setJumpRequestKey((key) => key + 1);
    if (threadId) setSelectedThreadId(threadId as Id<'clubChannelMessages'>);
  };

  // The channel's own controls follow its name, so they keep one edge with
  // the title instead of drifting against the global search (their old
  // position moved with the width of the account name).
  const title: ReactNode = (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <ClubChannelVisibilityIcon
          visibility={channel.visibility}
          className="shrink-0 text-muted-foreground"
        />
        <h1 className="truncate text-base font-semibold text-foreground">
          {channel.name}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          {whiteboardsEnabled ? (
            <TabsSubtle
              selectedIndex={showWhiteboard ? 1 : 0}
              onSelect={(index) =>
                setChannelView(index === 1 ? 'whiteboard' : 'chat')
              }
            >
              <TabsSubtleItem index={0} label="Chat" />
              <TabsSubtleItem index={1} label="Whiteboards" />
            </TabsSubtle>
          ) : null}
          <ChannelNotificationSettings
            clubId={clubId}
            channelId={channelId}
            channelName={channel.name}
          />
          <PinnedMessagesButton
            messages={pinnedMessages}
            hasMore={pinnedResult?.hasMore}
            onJump={jumpToMessage}
          />
        </div>
        <ChannelSearch
          clubId={clubId}
          channelId={channelId}
          channelName={channel.name}
          onJump={jumpToMessage}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="sm:hidden"
              variant="ghost"
              size="icon-sm"
              badge={pinnedMessages.length ? '·' : undefined}
              aria-label="Channel options"
            >
              <MoreHorizontal />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <div className="flex items-center gap-2">
              <ChannelNotificationSettings
                clubId={clubId}
                channelId={channelId}
                channelName={channel.name}
              />
              <PinnedMessagesButton
                messages={pinnedMessages}
                hasMore={pinnedResult?.hasMore}
                onJump={jumpToMessage}
              />
              {whiteboardsEnabled ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setChannelView(showWhiteboard ? 'chat' : 'whiteboard')
                  }
                >
                  {showWhiteboard ? 'Chat' : 'Whiteboards'}
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  const rightPane = selectedThread ? (
    <div className="flex size-full min-h-0 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <p className="text-sm font-semibold">Thread</p>
        <Button
          variant="ghost"
          size="icon-sm"
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
        <ScrollToReplyTarget
          messageId={jumpedToMessageId}
          requestKey={jumpRequestKey}
          targetPresent={threadReplies.some(
            (message) => message._id === jumpedToMessageId,
          )}
        />
        <MessageScroller
          className={cn(
            'min-h-0 flex-1',
            isTouchPrimary && TOUCH_TIMELINE_CLASS,
          )}
        >
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-0 p-2">
              <MessageScrollerItem messageId={selectedThread._id}>
                {renderMessageRow(selectedThread)}
              </MessageScrollerItem>
              {threadReplies.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No replies yet.
                </p>
              ) : null}
              {threadReplies.map((reply, index) => (
                <MessageScrollerItem key={reply._id} messageId={reply._id}>
                  {renderMessageRow(
                    reply,
                    true,
                    shouldGroupMessages(threadReplies[index - 1], reply),
                  )}
                </MessageScrollerItem>
              ))}
              {renderFailedSends(selectedThread._id)}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton className={CHAT_SCROLL_BUTTON_CLASS} />
        </MessageScroller>
      </MessageScrollerProvider>

      <div
        className={cn(
          'channel-thread-dock min-h-16 shrink-0 p-2',
          CARD_SURFACE_FOREGROUND,
        )}
      >
        {canPost && !selectedThread.isDeleted ? (
          <ChannelMessageComposer
            key={`reply-${selectedThread._id}`}
            handleRef={replyComposerRef}
            onTypingActivity={onTypingActivity}
            onSubmit={(args) =>
              void submitMessage({
                ...args,
                parentMessageId: selectedThread._id,
                mode: 'thread',
              })
            }
            isPending={sendingMode === 'thread'}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
            canCreatePoll={conversationContext.canCreatePolls}
            onMentionIntent={() => setMentionContextRequested(true)}
          />
        ) : selectedThread.isDeleted ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            Replies are closed because the original message was deleted.
          </p>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            Only leaders, sponsors and admins can reply in #{channel.name}.
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <ImageViewerContext.Provider value={openImageViewer}>
      <MediaPlaybackContext.Provider value={!imageViewer?.open}>
        <ClubWorkspace
          title={title}
          rightPane={rightPane}
          resizableRightPane
          mobileRightPane={{
            title: 'Thread',
            onClose: () => setSelectedThreadId(null),
          }}
          contentClassName={cn(
            'channel-chat-surface relative flex h-full min-h-0 flex-col bg-card',
            CARD_SURFACE_FOREGROUND,
          )}
          scrollOwner="content"
        >
          <MessageScrollerProvider
            autoScroll
            defaultScrollPosition="end"
            scrollEdgeThreshold={CHAT_SCROLL_EDGE_THRESHOLD}
          >
            <HistoryPagination
              status={messagePageStatus}
              loadMore={loadMoreMessages}
            />
            <ScrollToReplyTarget
              messageId={jumpedToMessageId}
              requestKey={jumpRequestKey}
              targetPresent={timelineMessages.some(
                (message) => message._id === jumpedToMessageId,
              )}
            />

            {showWhiteboard ? (
              <div className="min-h-0 flex-1">
                <ChannelWhiteboard
                  key={channelId}
                  channelId={channelId}
                  channelName={channel.name}
                />
              </div>
            ) : (
              <MessageScroller
                className={cn(
                  'min-h-0 flex-1',
                  isTouchPrimary && TOUCH_TIMELINE_CLASS,
                )}
              >
                <MessageScrollerViewport preserveScrollOnPrepend>
                  <MessageScrollerContent
                    className={cn('w-full gap-0 px-4 py-2')}
                  >
                    {messagePageStatus === 'CanLoadMore' ||
                    messagePageStatus === 'LoadingMore' ? (
                      <MessageScrollerItem messageId="history-start">
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
                        <MessageScrollerItem
                          key={message._id}
                          messageId={message._id}
                        >
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
                            message._id !== firstUnreadMessageId &&
                              shouldGroupMessages(
                                visibleMessages[index - 1],
                                message,
                              ),
                          )}
                        </MessageScrollerItem>
                      ))
                    ) : messagePageStatus === 'LoadingFirstPage' ? (
                      <Skeleton className="mx-3 my-4 h-20 w-2/3" />
                    ) : (
                      <MessageScrollerItem>
                        <div className="px-3 py-8">
                          <h2 className="text-xl font-semibold">
                            #{channel.name}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            This is the start of #{channel.name}.
                          </p>
                          {channel.description ? (
                            <p className="mt-2 max-w-[75ch] text-sm">
                              {channel.description}
                            </p>
                          ) : null}
                        </div>
                      </MessageScrollerItem>
                    )}
                    {renderFailedSends()}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <NewMessagesButton messages={messages} viewerId={user?._id} />
              </MessageScroller>
            )}
          </MessageScrollerProvider>

          {showWhiteboard ? null : (
            <div
              className={cn(
                'channel-composer-dock min-h-16 shrink-0 bg-card px-4 pb-2 pt-1.5',
                CARD_SURFACE_FOREGROUND,
              )}
            >
              <div className="w-full">
                <TypingPresence
                  clubId={clubId}
                  channelId={channelId}
                  active={typingActive && canPost}
                />
                {canPost ? (
                  <div className="flex flex-col gap-1.5">
                    <ChannelMessageComposer
                      key={channelId}
                      replyTo={
                        replyingToMessageId
                          ? {
                              author: replyingToMessage
                                ? fullName(replyingToMessage.author)
                                : 'an earlier message',
                              excerpt: replyingToMessage?.body ?? '',
                              onCancel: () => setReplyingToMessageId(null),
                            }
                          : undefined
                      }
                      onEditLast={() => {
                        const last = [...messages]
                          .reverse()
                          .find(
                            (message) =>
                              message.authorId === user?._id &&
                              !message.isDeleted &&
                              !('deliveryState' in message),
                          );
                        if (last) setEditingMessageId(last._id);
                      }}
                      handleRef={rootComposerRef}
                      onTypingActivity={onTypingActivity}
                      onSubmit={(args) =>
                        void submitMessage({
                          ...args,
                          replyToMessageId: replyingToMessageId ?? undefined,
                          mode: 'root',
                        })
                      }
                      isPending={sendingMode === 'root'}
                      suggestionEntries={suggestionEntries}
                      placeholder={
                        replyingToMessage
                          ? `Reply to ${fullName(replyingToMessage.author)}`
                          : `Message #${channel.name}`
                      }
                      submitLabel="Send"
                      canCreatePoll={conversationContext.canCreatePolls}
                      onMentionIntent={() => setMentionContextRequested(true)}
                    />
                  </div>
                ) : (
                  <p className="flex min-h-12 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ClubChannelVisibilityIcon
                      visibility={channel.visibility}
                    />
                    Only leaders, sponsors and admins can post in #
                    {channel.name}.
                  </p>
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
                  Reports go to school staff for review. Include enough context
                  to understand the issue.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="min-h-28"
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
                <Button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={!reportReason.trim()}
                >
                  Submit report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ClubWorkspace>
      </MediaPlaybackContext.Provider>
      {imageViewer ? (
        <ImageViewer
          images={imageViewer.images}
          index={imageViewer.index}
          open={imageViewer.open}
          onClose={() =>
            setImageViewer((current) => current && { ...current, open: false })
          }
        />
      ) : null}
    </ImageViewerContext.Provider>
  );
}

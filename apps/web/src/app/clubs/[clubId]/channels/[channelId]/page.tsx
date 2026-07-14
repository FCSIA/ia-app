'use client';

import { use, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import {
  BarChart3,
  FileText,
  History,
  ImageIcon,
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Reply,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { AppRole } from '~/apps/convex/lib/roles';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import type {
  ClubChannelMessage,
  ClubDetail,
} from '@/components/clubs/types';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { SearchInput } from '@/components/ui/search';
import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery, normalizeSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

function AttachmentGallery({ attachments }: { attachments: ClubChannelMessageAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => {
        const href = attachment.fileUrl;
        const sizeLabel = formatBytes(attachment.size);

        if (isImageAttachment(attachment)) {
          return (
            <a
              key={attachment._id}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border bg-muted/30"
            >
              <Image
                src={href}
                alt={attachment.fileName}
                width={1200}
                height={800}
                unoptimized
                className="max-h-72 w-full object-cover"
              />
              <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs">
                <span className="truncate">{attachment.fileName}</span>
                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
            </a>
          );
        }

        return (
          <a
            key={attachment._id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <FileText className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{attachment.fileName}</p>
              {sizeLabel ? (
                <p className="text-xs text-muted-foreground">{sizeLabel}</p>
              ) : null}
            </div>
          </a>
        );
      })}
    </div>
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
      className="mt-1"
    />
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
      <HoverCardContent side="right" align="start" className="w-72 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ClubAvatar person={author} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="font-mono text-xs text-muted-foreground">{author.uniqueId}</p>
            {roleLabels.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {roleLabels.map((role) => (
                  <Badge key={role} variant="dot" className="h-5 text-[10px]">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
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
    <div className="mt-3 rounded-2xl border bg-muted/20 p-3">
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
                'relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
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

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-md px-3 py-2 transition-colors',
        highlighted && 'bg-primary/[0.04]',
        !compact && 'hover:bg-muted/40',
        isEditing && 'bg-primary/[0.04] hover:bg-primary/[0.04]',
      )}
    >
      <MessageAuthorPreview
        author={message.author}
        compact={compact}
        currentUserId={currentUserId}
        canSendFriendRequest={canSendFriendRequest}
        friendRequestPendingId={friendRequestPendingId}
        onSendFriendRequest={onSendFriendRequest}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">
            {fullName(message.author)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {message.isPinned ? (
            <Badge variant="dot" color="amber" className="h-5 text-[10px]">
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
        </div>

        {isDeleted ? (
          <p className="mt-1 text-sm italic text-muted-foreground">Message deleted</p>
        ) : isEditing ? (
          <div className="mt-2" />
        ) : (
          <>
            <MessageBody message={message} />
            <PollCard message={message} onVote={onVotePoll} isPending={isVotePending} />
            <AttachmentGallery attachments={message.attachments} />
          </>
        )}

        {!isEditing && (
          <>
            {!isDeleted ? (
              <>
                {message.reactions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.reactions.map((reaction) => (
                      <Button
                        key={`${message._id}-${reaction.emoji}`}
                        variant="tertiary"
                        size="sm"
                        className={cn(
                          'h-6 gap-1 px-2 text-xs',
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

                <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {QUICK_REACTIONS.map((reaction) => (
                    <Button
                      key={`${message._id}-${reaction.value}-quick`}
                      variant="ghost"
                      size="sm"
                      className="size-6 p-0 text-sm"
                      disabled={isReactionPending}
                      aria-label={reaction.name}
                      onClick={() => onToggleReaction(message._id, reaction.value)}
                    >
                      {reaction.label}
                    </Button>
                  ))}
                  {!compact ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                      onClick={() => onOpenThread(message.threadRootId)}
                    >
                      <Reply className="size-3" />
                      Reply
                    </Button>
                  ) : null}
                  {isAuthor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                      onClick={() => onStartEdit(message._id)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                  )}
                  {!isAuthor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-amber-600"
                      onClick={() => onReport?.(message._id)}
                    >
                      <Flag className="size-3" />
                      Report
                    </Button>
                  )}
                  {(isAuthor || canModerate) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      disabled={isDeletePending}
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="text-sm text-muted-foreground">
                          This removes the message content for everyone in the channel.
                          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                            <div className="text-xs">
                              <strong>Note:</strong> The deletion is logged for school administrators.
                              If the message has replies, a content-free placeholder keeps the thread intact.
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
                  )}
                  {canModerate && !compact ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                  disabled={isPinPending}
                  onClick={() => onTogglePin(message._id, !message.isPinned)}
                >
                  {message.isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                  {message.isPinned ? 'Unpin' : 'Pin'}
                </Button>
                  ) : null}
                </div>
              </>
            ) : null}

            {!compact && message.replyCount > 0 ? (
              <button
                type="button"
                className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                onClick={() => onOpenThread(message.threadRootId)}
              >
                <Reply className="size-3" />
                {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
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
  const deferredSearch = useDeferredValue(search);

  const user = useCurrentUser();

  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const messages =
    useQuery(api.clubs.channels.getMessages, { clubId, channelId }) ?? [];

  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeChatAttachment = useMutation(api.uploads.files.finalizeChatAttachment);
  const discardChatAttachment = useMutation(api.uploads.files.discardChatAttachment);
  const postMessage = useMutation(api.clubs.channels.postMessage);
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
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
    try {
      for (const file of files) {
        const storageId = await uploadFileToConvex(
          { generateUploadUrl: () => generateUploadUrl({}) },
          file,
        );
        const staged = await finalizeChatAttachment({
          storageId,
          fileName: file.name,
        });
        attachmentUploadIds.push(staged.attachmentUploadId);
      }
      await postMessage({
        channelId,
        body: body.trim(),
        bodyMarkdown: bodyMarkdown.trim() || undefined,
        bodyRich: body.trim() ? bodyRich ?? undefined : undefined,
        parentMessageId: parentMessageId as Id<'clubChannelMessages'> | undefined,
        pollQuestion,
        pollOptions,
        attachments: attachmentUploadIds,
      });
      if (mode === 'thread') {
        setReplyComposerResetKey((current) => current + 1);
      } else {
        setRootComposerResetKey((current) => current + 1);
      }
    } catch {
      await Promise.allSettled(
        attachmentUploadIds.map((attachmentUploadId) =>
          discardChatAttachment({ attachmentUploadId }),
        ),
      );
      toast({ title: 'Failed to send message', variant: 'destructive' });
    }
  };

  const channel = useMemo(
    () => club?.channels?.find((entry) => entry._id === channelId),
    [channelId, club?.channels],
  );

  const audience = useMemo(() => {
    if (!club || !channel) return [];
    if (channel.visibility !== 'PRIVATE') return club.directory;
    const explicitIds = new Set(channel.memberships?.map((m) => m.userId) ?? []);
    return club.directory.filter((p) => p.kind === 'SPONSOR' || explicitIds.has(p._id));
  }, [channel, club]);

  const suggestionEntries = useMemo<ChannelMentionSuggestion[]>(() => {
    const canUseAll = !!club?.viewer?.canManageChannels;
    const builtIns: ChannelMentionSuggestion[] = [
      ...(canUseAll ? [{ token: 'all', label: 'Everyone in this channel', detail: '', kind: 'built-in' as const }] : []),
      { token: 'leaders', label: 'Members with club roles', detail: '', kind: 'built-in' },
      { token: 'sponsors', label: 'Faculty sponsors', detail: '', kind: 'built-in' },
    ];
    const tags = club?.tags?.map((tag) => ({
      token: tag.slug,
      label: tag.name,
      detail: `${tag.members.length} member${tag.members.length === 1 ? '' : 's'}`,
      kind: 'tag' as const,
    })) ?? [];
    const people = audience
      .filter((person) => !!person.uniqueId)
      .map((person) => ({
        token: person.uniqueId!,
        label: fullName(person),
        detail: person.clubRole
          ? `${person.kind} · ${formatClubRole(person.clubRole)}`
          : person.kind,
        kind: 'person' as const,
      }));
    return [...builtIns, ...tags, ...people];
  }, [audience, club?.tags, club?.viewer?.canManageChannels]);

  const flattenedMessages = useMemo(
    () =>
      messages.flatMap((message) => [
        message,
        ...message.replies.map((reply) => ({ ...reply, threadRootId: message._id })),
      ]),
    [messages],
  );

  const matchingIds = useMemo(() => {
    const query = normalizeSearchQuery(deferredSearch);
    if (!query) return new Set<string>();
    return new Set(
      filterBySearchQuery(flattenedMessages, query, (message) => [
        getSearchableText(message),
      ]).map((message) => message._id),
    );
  }, [deferredSearch, flattenedMessages]);

  const visibleMessages = useMemo(() => {
    if (matchingIds.size === 0) return messages;
    return messages.filter(
      (message) =>
        matchingIds.has(message._id) || message.replies.some((r) => matchingIds.has(r._id)),
    );
  }, [matchingIds, messages]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return messages.find((m) => m._id === selectedThreadId) ?? null;
  }, [messages, selectedThreadId]);

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

  if (!club || !channel) {
    return (
      <ClubWorkspace>
        <div className="flex h-full items-center justify-center py-20 text-sm text-muted-foreground">
          Channel not found or you don&apos;t have access.
        </div>
      </ClubWorkspace>
    );
  }

  const canPost = channel.viewerCanPost ?? true;
  const canModerateChannel = !!club.viewer?.canManageChannels;
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
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
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-2 p-2">
              <MessageScrollerItem messageId={selectedThread._id}>
                {renderMessageRow(selectedThread)}
              </MessageScrollerItem>
              {selectedThread.replies.map((reply) => (
                <MessageScrollerItem key={reply._id} messageId={reply._id}>
                  {renderMessageRow(reply, true)}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t p-3">
        {canPost && !selectedThread.isDeleted ? (
          <ChannelMessageComposer
            key={`reply-${selectedThread._id}-${replyComposerResetKey}`}
            onSubmit={(args) => void submitMessage({ ...args, parentMessageId: selectedThread._id, mode: 'thread' })}
            isPending={false}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
            canCreatePoll={canModerateChannel}
          />
        ) : selectedThread.isDeleted ? (
          <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            Replies are closed because the original message was deleted.
          </div>
        ) : (
          <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
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
      contentClassName="relative flex flex-col bg-card"
    >
      <div className="shrink-0 border-b px-3 py-2">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-2">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search messages"
            className="w-full sm:ml-auto sm:w-72"
          />

          <div className="shrink-0">
            <ChannelNotificationSettings
              clubId={clubId}
              channelId={channelId}
              channelName={channel.name}
            />
          </div>
        </div>
      </div>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-4xl gap-1 p-3 pb-48">
              {pinnedMessages.length > 0 ? (
                <MessageScrollerItem>
                  <div className="mb-3 rounded-2xl border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <Pin className="size-3.5" />
                      Pinned
                    </div>
                    <div className="flex flex-col gap-1">
                      {pinnedMessages.map((message) => (
                        <button
                          key={message._id}
                          type="button"
                          className="block w-full truncate rounded-xl px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onClick={() => setSelectedThreadId(message.threadRootId)}
                        >
                          <span className="font-medium">{fullName(message.author)}:</span>{' '}
                          {message.poll?.question || message.body || 'Attachment'}
                        </button>
                      ))}
                    </div>
                  </div>
                </MessageScrollerItem>
              ) : null}

              {visibleMessages.length > 0 ? (
                visibleMessages.map((message) => (
                  <MessageScrollerItem key={message._id} messageId={message._id}>
                    {renderMessageRow(message)}
                  </MessageScrollerItem>
                ))
              ) : (
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
          <MessageScrollerButton className="data-[direction=end]:bottom-44" />
        </MessageScroller>
      </MessageScrollerProvider>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-card via-card/90 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          {canPost ? (
            <ChannelMessageComposer
              key={`root-${rootComposerResetKey}`}
              onSubmit={(args) => void submitMessage({ ...args, mode: 'root' })}
              isPending={false}
              suggestionEntries={suggestionEntries}
              placeholder={`Message #${channel.name}`}
              submitLabel="Send"
              canCreatePoll={canModerateChannel}
            />
          ) : (
            <div className="rounded-[1.5rem] border bg-background/95 px-5 py-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">
                {getClubChannelVisibilityLabel(channel.visibility)} channel
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Members can read everything here, but only club leaders, sponsors, and admins can post.
              </p>
            </div>
          )}
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {audience.length} {audience.length === 1 ? 'person' : 'people'} can see this channel · Messages tracked
          </p>
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

'use client';

import { use, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from 'convex/react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useClubId, useRouteChannelId } from '@/app/clubs/club-route';
import type {
  ClubChannelMessage,
  ClubDetail,
} from '@/components/clubs/types';

type ClubChannelMessageRichBody = NonNullable<ClubChannelMessage['bodyRich']>;
type ClubChannelMessageAttachment = ClubChannelMessage['attachments'][number];
type ChatAttachmentUploadResponse = {
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
};
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
import { MentionBody } from '@/components/clubs/mention-body';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { SearchInput } from '@/components/ui/search';
import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { toApiUrl } from '@/lib/api';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { useCurrentUser } from '@/lib/auth';
import { filterBySearchQuery, normalizeSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎉', '👀'];

type ComposerSubmitArgs = {
  body: string;
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
  return (
    attachment.mimeType?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.fileName)
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

function AttachmentGallery({ attachments }: { attachments: ClubChannelMessageAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => {
        const href = toApiUrl(attachment.fileUrl);
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

function MarkdownMessage({ body }: { body: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert mt-1 max-w-none text-sm leading-6 prose-p:my-1 prose-pre:my-2 prose-pre:rounded-xl prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

function MessageBody({ message }: { message: ClubChannelMessage }) {
  if (Array.isArray(message.bodyRich) && message.bodyRich.length > 0) {
    return (
      <MentionBody
        body={message.body}
        bodyRich={message.bodyRich}
        className="mt-1"
      />
    );
  }

  return message.body ? <MarkdownMessage body={message.body} /> : null;
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
  isEditing,
  isReactionPending,
  isPinPending,
  isVotePending,
  isDeletePending,
  highlighted,
  canModerate,
  currentUserId,
  compact = false,
}: {
  message: ClubChannelMessage;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onStartEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onShowHistory?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  isEditing: boolean;
  isReactionPending: boolean;
  isPinPending: boolean;
  isVotePending: boolean;
  isDeletePending: boolean;
  highlighted: boolean;
  canModerate: boolean;
  currentUserId?: string;
  compact?: boolean;
}) {
  const isAuthor = message.author._id === currentUserId;
  const isFiltered = message.body.includes('***'); // Simple heuristic for rule-breaking messages - TODO: NEEDS TO BE UPDATED THOUGH as users can type asterisks for fun.
  const isEdited = message.updatedAt !== message.createdAt;

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-md px-3 py-2 transition-colors',
        highlighted && 'bg-primary/[0.04]',
        !compact && 'hover:bg-muted/40',
        isEditing && 'bg-primary/[0.04] hover:bg-primary/[0.04]',
      )}
    >
      <ClubAvatar
        person={message.author}
        className={compact ? 'size-7' : 'size-9'}
        fallbackClassName={compact ? 'text-[10px]' : 'text-[11px]'}
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

        {isEditing ? (
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
                    disabled={isReactionPending}
                    onClick={() => onToggleReaction(message._id, reaction.emoji)}
                  >
                    <span>{reaction.emoji}</span>
                    {reaction.count}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {QUICK_REACTIONS.map((emoji) => (
                <Button
                  key={`${message._id}-${emoji}-quick`}
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-sm"
                  disabled={isReactionPending}
                  onClick={() => onToggleReaction(message._id, emoji)}
                >
                  {emoji}
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
              {isAuthor && !isFiltered && (
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
                          This will remove the message for everyone in the channel.
                          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                            <div className="text-xs">
                              <strong>Note:</strong> While the message will be hidden from the UI,
                              all message activity is still logged and visible to school administrators
                              in the audit panel.
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
  const deferredSearch = useDeferredValue(search);

  const user = useCurrentUser();

  const club = useQuery(api.clubs.detail.get, { clubId }) as ClubDetail | undefined;
  const messages = useQuery(api.clubs.channels.getMessages, { channelId }) ?? [];

  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeChatAttachment = useMutation(api.uploads.files.finalizeChatAttachment);
  const postMessage = useMutation(api.clubs.channels.postMessage);
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const votePoll = useMutation(api.clubs.channels.votePoll);

  const submitMessage = async ({
    body,
    bodyRich,
    parentMessageId,
    files,
    pollQuestion,
    pollOptions,
    mode,
  }: ComposerSubmitArgs) => {
    try {
      const uploadedAttachments = await Promise.all(
        files.map(async (file) => {
          const storageId = await uploadFileToConvex(
            { generateUploadUrl: () => generateUploadUrl({}) },
            file,
          );
          return finalizeChatAttachment({
            storageId,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
          });
        }),
      );
      await postMessage({
        channelId,
        body: body.trim(),
        bodyRich: body.trim() ? bodyRich ?? undefined : undefined,
        parentMessageId: parentMessageId as Id<'clubChannelMessages'> | undefined,
        pollQuestion,
        pollOptions,
        attachments: uploadedAttachments.map((a: ChatAttachmentUploadResponse) => ({
          fileName: a.fileName,
          fileUrl: a.url,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });
      if (mode === 'thread') {
        setReplyComposerResetKey((current) => current + 1);
      } else {
        setRootComposerResetKey((current) => current + 1);
      }
    } catch {
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

  const renderMessageRow = (message: ClubChannelMessage, compact = false) => {
    const isEditing = editingMessageId === message._id;

    return (
      <div key={message._id}>
        <MessageRow
          message={message}
          currentUserId={user?.id}
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
          isEditing={isEditing}
          isReactionPending={false}
          isPinPending={false}
          isVotePending={false}
          isDeletePending={false}
          highlighted={matchingIds.has(message._id)}
          canModerate={canModerateChannel}
          compact={compact}
        />
        {isEditing && (
          <div className="ml-12 mr-3 mt-1">
            <ChannelMessageComposer
              suggestionEntries={suggestionEntries}
              placeholder="Edit message..."
              submitLabel="Save Changes"
              isPending={false}
              resetKey={0}
              onSubmit={({ body, bodyRich }) =>
                void updateMessage({
                  messageId: message._id,
                  body,
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

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {selectedThread && renderMessageRow(selectedThread)}
        {selectedThread?.replies.map((reply) => renderMessageRow(reply, true))}
      </div>

      <div className="border-t p-3">
        {canPost ? (
          <ChannelMessageComposer
            resetKey={replyComposerResetKey}
            onSubmit={(args) => void submitMessage({ ...args, parentMessageId: selectedThread._id, mode: 'thread' })}
            isPending={false}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
            canCreatePoll={canModerateChannel}
          />
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
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-1 p-3 pb-48">
          <div className="mb-3 flex items-center gap-2">
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
          {pinnedMessages.length > 0 ? (
            <div className="mb-3 rounded-2xl border bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Pin className="size-3.5" />
                Pinned
              </div>
              <div className="space-y-1">
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
          ) : null}
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => renderMessageRow(message))
          ) : (
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
          )}
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-card via-card/90 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          {canPost ? (
            <ChannelMessageComposer
              resetKey={rootComposerResetKey}
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
    </ClubWorkspace>
        );
        }

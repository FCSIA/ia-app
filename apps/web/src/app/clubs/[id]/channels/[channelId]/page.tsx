'use client';

import { use, useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import {
  FileText,
  ImageIcon,
  MessageSquareText,
  Reply,
  X,
} from 'lucide-react';
import type {
  ChatAttachmentUploadResponse,
  ClubChannelMessage,
  ClubChannelMessageRichBody,
  ClubChannelMessageAttachment,
  ClubDetail,
} from '@ia/contracts/clubs';
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
import { clubsApi, toApiUrl, uploadsApi } from '@/lib/api';
import { filterBySearchQuery, normalizeSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎉', '👀'];

type ComposerSubmitArgs = {
  body: string;
  bodyRich: ClubChannelMessageRichBody | null;
  parentMessageId?: string;
  files: File[];
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
              key={attachment.id}
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
            key={attachment.id}
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

function MessageRow({
  message,
  onOpenThread,
  onToggleReaction,
  isReactionPending,
  highlighted,
  compact = false,
}: {
  message: ClubChannelMessage;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isReactionPending: boolean;
  highlighted: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'group flex gap-3 rounded-md px-3 py-2 transition-colors',
        highlighted && 'bg-primary/[0.04]',
        !compact && 'hover:bg-muted/40',
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
        </div>

        {message.body || message.bodyRich ? (
          <MentionBody
            body={message.body}
            bodyRich={message.bodyRich}
            className="mt-1 text-sm leading-6"
          />
        ) : null}

        <AttachmentGallery attachments={message.attachments} />

        {message.mentions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.mentions.map((mention) => (
              <Badge key={mention.id} variant="outline" className="h-5 font-mono text-[10px]">
                @{mention.token}
              </Badge>
            ))}
          </div>
        ) : null}

        {message.reactions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <Button
                key={`${message.id}-${reaction.emoji}`}
                variant="outline"
                size="sm"
                className={cn(
                  'h-6 gap-1 px-2 text-xs',
                  reaction.reactedByCurrentUser && 'border-primary/40 bg-primary/10',
                )}
                disabled={isReactionPending}
                onClick={() => onToggleReaction(message.id, reaction.emoji)}
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
              key={`${message.id}-${emoji}-quick`}
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-sm"
              disabled={isReactionPending}
              onClick={() => onToggleReaction(message.id, emoji)}
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
      </div>
    </div>
  );
}

export default function ClubChannelPage({
  params,
}: {
  params: Promise<{ id: string; channelId: string }>;
}) {
  const { id, channelId } = use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rootComposerResetKey, setRootComposerResetKey] = useState(0);
  const [replyComposerResetKey, setReplyComposerResetKey] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((r) => r.data),
  });

  const { data: messages = [] } = useQuery<ClubChannelMessage[]>({
    queryKey: ['club-channel-messages', id, channelId],
    queryFn: () => clubsApi.getChannelMessages(id, channelId).then((r) => r.data),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ body, bodyRich, parentMessageId, files }: ComposerSubmitArgs) => {
      const uploadedAttachments = await Promise.all(
        files.map((file) =>
          uploadsApi.uploadChatAttachment(file).then((response) => response.data),
        ),
      );
      return clubsApi.postChannelMessage(id, channelId, {
        body: body.trim() || undefined,
        bodyRich: body.trim() ? bodyRich ?? undefined : undefined,
        parentMessageId,
        attachments: uploadedAttachments.map((a: ChatAttachmentUploadResponse) => ({
          fileName: a.originalName,
          fileUrl: a.url,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
      queryClient.invalidateQueries({ queryKey: ['club', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      if (variables.mode === 'thread') {
        setReplyComposerResetKey((current) => current + 1);
      } else {
        setRootComposerResetKey((current) => current + 1);
      }
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      clubsApi.toggleChannelReaction(id, channelId, messageId, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to update reaction',
        variant: 'destructive',
      });
    },
  });

  const channel = useMemo(
    () => club?.channels?.find((entry) => entry.id === channelId),
    [channelId, club?.channels],
  );

  const audience = useMemo(() => {
    if (!club || !channel) return [];
    if (channel.visibility !== 'PRIVATE') return club.directory;
    const explicitIds = new Set(channel.memberships?.map((m) => m.userId) ?? []);
    return club.directory.filter((p) => p.kind === 'SPONSOR' || explicitIds.has(p.id));
  }, [channel, club]);

  const suggestionEntries = useMemo<ChannelMentionSuggestion[]>(() => {
    const builtIns: ChannelMentionSuggestion[] = [
      { token: 'all', label: 'Everyone in this channel', detail: '', kind: 'built-in' },
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
  }, [audience, club?.tags]);

  const flattenedMessages = useMemo(
    () =>
      messages.flatMap((message) => [
        message,
        ...message.replies.map((reply) => ({ ...reply, threadRootId: message.id })),
      ]),
    [messages],
  );

  const matchingIds = useMemo(() => {
    const query = normalizeSearchQuery(deferredSearch);
    if (!query) return new Set<string>();
    return new Set(
      filterBySearchQuery(flattenedMessages, query, (message) => [
        getSearchableText(message),
      ]).map((message) => message.id),
    );
  }, [deferredSearch, flattenedMessages]);

  const visibleMessages = useMemo(() => {
    if (matchingIds.size === 0) return messages;
    return messages.filter(
      (message) =>
        matchingIds.has(message.id) || message.replies.some((r) => matchingIds.has(r.id)),
    );
  }, [matchingIds, messages]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return messages.find((m) => m.id === selectedThreadId) ?? null;
  }, [messages, selectedThreadId]);

  if (!club || !channel) {
    return (
      <ClubWorkspace clubId={id}>
        <div className="flex h-full items-center justify-center py-20 text-sm text-muted-foreground">
          Channel not found or you don&apos;t have access.
        </div>
      </ClubWorkspace>
    );
  }

  const canPost = channel.viewerCanPost ?? true;

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

  const actions: ReactNode = (
    <div className="w-56">
      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search messages"
        size="sm"
        className="h-8 rounded-lg"
        inputClassName="text-sm"
      />
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
        <MessageRow
          message={selectedThread}
          onOpenThread={setSelectedThreadId}
          onToggleReaction={(messageId, emoji) => reactionMutation.mutate({ messageId, emoji })}
          isReactionPending={reactionMutation.isPending}
          highlighted={false}
        />
        {selectedThread.replies.map((reply) => (
          <MessageRow
            key={reply.id}
            message={reply}
            onOpenThread={setSelectedThreadId}
            onToggleReaction={(messageId, emoji) => reactionMutation.mutate({ messageId, emoji })}
            isReactionPending={reactionMutation.isPending}
            highlighted={false}
            compact
          />
        ))}
      </div>

      <div className="border-t p-3">
        {canPost ? (
          <ChannelMessageComposer
            resetKey={replyComposerResetKey}
            onSubmit={({ body, bodyRich, files }) =>
              sendMessageMutation.mutate({
                body,
                bodyRich,
                parentMessageId: selectedThread.id,
                files,
                mode: 'thread',
              })
            }
            isPending={sendMessageMutation.isPending}
            suggestionEntries={suggestionEntries}
            placeholder="Reply in thread…"
            submitLabel="Reply"
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
      clubId={id}
      title={title}
      actions={actions}
      rightPane={rightPane}
      contentClassName="relative flex flex-col bg-card"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-1 p-3 pb-48">
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => (
              <div key={message.id}>
                <MessageRow
                  message={message}
                  onOpenThread={setSelectedThreadId}
                  onToggleReaction={(messageId, emoji) =>
                    reactionMutation.mutate({ messageId, emoji })
                  }
                  isReactionPending={reactionMutation.isPending}
                  highlighted={matchingIds.has(message.id)}
                />
              </div>
            ))
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
                    : `Start the conversation in #${channel.name}.`}
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
              onSubmit={({ body, bodyRich, files }) =>
                sendMessageMutation.mutate({
                  body,
                  bodyRich,
                  files,
                  mode: 'root',
                })
              }
              isPending={sendMessageMutation.isPending}
              suggestionEntries={suggestionEntries}
              placeholder={`Message #${channel.name}`}
              submitLabel="Send"
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
            {audience.length} {audience.length === 1 ? 'person' : 'people'} can see this channel · {getClubChannelVisibilityLabel(channel.visibility)} visibility
          </p>
        </div>
      </div>
    </ClubWorkspace>
  );
}

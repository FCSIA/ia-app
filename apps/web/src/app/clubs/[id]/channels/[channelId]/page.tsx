'use client';

import { use, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Hash,
  ImageIcon,
  Lock,
  MessageSquareText,
  Paperclip,
  Reply,
  Search,
  Send,
  X,
} from 'lucide-react';
import type {
  ChatAttachmentUploadResponse,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubDetail,
} from '@ia/contracts/clubs';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { MentionBody } from '@/components/clubs/mention-body';
import { formatClubRole, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { clubsApi, toApiUrl, uploadsApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎉', '👀'];

type MentionSuggestion = {
  token: string;
  label: string;
  detail: string;
  kind: 'built-in' | 'tag' | 'person';
};

type ComposerSubmitArgs = {
  body: string;
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

function getActiveMentionMatch(value: string, selectionStart: number) {
  const beforeCursor = value.slice(0, selectionStart);
  const match = beforeCursor.match(/(?:^|\s)@([A-Za-z0-9_-]*)$/);
  if (!match) return null;
  return {
    query: (match[1] ?? '').toLowerCase(),
    replaceStart: selectionStart - (match[1]?.length ?? 0) - 1,
    replaceEnd: selectionStart,
  };
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
              <img
                src={href}
                alt={attachment.fileName}
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
  currentUserId,
  onOpenThread,
  onToggleReaction,
  isReactionPending,
  highlighted,
  compact = false,
}: {
  message: ClubChannelMessage;
  currentUserId?: string;
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

        {message.body ? (
          <MentionBody body={message.body} className="mt-1 text-sm leading-6" />
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

function MessageComposer({
  value,
  onValueChange,
  files,
  onAddFiles,
  onRemoveFile,
  onSubmit,
  isPending,
  suggestionEntries,
  placeholder,
  submitLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  suggestionEntries: MentionSuggestion[];
  placeholder: string;
  submitLabel: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionStart, setSelectionStart] = useState(0);

  const mentionMatch = useMemo(
    () => getActiveMentionMatch(value, selectionStart),
    [selectionStart, value],
  );

  const visibleSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const query = mentionMatch.query.trim();
    return suggestionEntries
      .filter((entry) =>
        !query
          ? true
          : [entry.token, entry.label, entry.detail]
              .join(' ')
              .toLowerCase()
              .includes(query),
      )
      .slice(0, 8);
  }, [mentionMatch, suggestionEntries]);

  const insertMention = (token: string) => {
    if (!mentionMatch) return;
    const nextValue = `${value.slice(0, mentionMatch.replaceStart)}@${token} ${value.slice(
      mentionMatch.replaceEnd,
    )}`;
    onValueChange(nextValue);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const nextCursor = mentionMatch.replaceStart + token.length + 2;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      setSelectionStart(nextCursor);
    });
  };

  const canSend = !isPending && (value.trim().length > 0 || files.length > 0);

  return (
    <div className="rounded-xl border bg-background shadow-sm">
      {files.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
          {files.map((file) => (
            <Badge key={file.name} variant="outline" className="gap-1 pr-1">
              <span className="max-w-40 truncate">{file.name}</span>
              <button
                type="button"
                className="rounded p-0.5 hover:bg-muted"
                onClick={() => onRemoveFile(file.name)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setSelectionStart(event.target.selectionStart ?? event.target.value.length);
          }}
          onKeyUp={(event) => setSelectionStart(event.currentTarget.selectionStart ?? 0)}
          onClick={(event) => setSelectionStart(event.currentTarget.selectionStart ?? 0)}
          onSelect={(event) => setSelectionStart(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={3}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />

        {mentionMatch && visibleSuggestions.length > 0 ? (
          <div className="absolute inset-x-2 bottom-full z-20 mb-1 rounded-lg border bg-popover shadow-md">
            <Command>
              <CommandList className="max-h-56">
                <CommandEmpty>No match</CommandEmpty>
                <CommandGroup>
                  {visibleSuggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.kind}-${suggestion.token}`}
                      value={`${suggestion.token} ${suggestion.label}`}
                      onSelect={() => insertMention(suggestion.token)}
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm">@{suggestion.token}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {suggestion.label}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {suggestion.kind}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const nextFiles = Array.from(event.target.files ?? []);
          if (nextFiles.length > 0) onAddFiles(nextFiles);
          event.currentTarget.value = '';
        }}
      />

      <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-1.5 size-3.5" />
          Attach
        </Button>
        <Button size="sm" className="h-7" disabled={!canSend} onClick={onSubmit}>
          <Send className="mr-1.5 size-3.5" />
          {isPending ? 'Sending…' : submitLabel}
        </Button>
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
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rootBody, setRootBody] = useState('');
  const [rootFiles, setRootFiles] = useState<File[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
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
    mutationFn: async ({ body, parentMessageId, files }: ComposerSubmitArgs) => {
      const uploadedAttachments = await Promise.all(
        files.map((file) =>
          uploadsApi.uploadChatAttachment(file).then((response) => response.data),
        ),
      );
      return clubsApi.postChannelMessage(id, channelId, {
        body: body.trim() || undefined,
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
        setReplyBody('');
        setReplyFiles([]);
      } else {
        setRootBody('');
        setRootFiles([]);
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
    if (!channel.isPrivate) return club.directory;
    const explicitIds = new Set(channel.memberships?.map((m) => m.userId) ?? []);
    return club.directory.filter((p) => p.kind === 'SPONSOR' || explicitIds.has(p.id));
  }, [channel, club]);

  const suggestionEntries = useMemo<MentionSuggestion[]>(() => {
    const builtIns: MentionSuggestion[] = [
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
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return new Set<string>();
    return new Set(
      flattenedMessages
        .filter((m) => getSearchableText(m).includes(query))
        .map((m) => m.id),
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
          Channel not found or you don't have access.
        </div>
      </ClubWorkspace>
    );
  }

  const title: ReactNode = (
    <div className="flex min-w-0 items-center gap-2">
      {channel.isPrivate ? (
        <Lock className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Hash className="size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-foreground">{channel.name}</h1>
        {channel.description ? (
          <p className="truncate text-xs text-muted-foreground">{channel.description}</p>
        ) : null}
      </div>
    </div>
  );

  const actions: ReactNode = (
    <div className="relative w-56">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search messages"
        className="h-8 pl-8 text-sm"
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
          currentUserId={user?.id}
          onOpenThread={setSelectedThreadId}
          onToggleReaction={(messageId, emoji) => reactionMutation.mutate({ messageId, emoji })}
          isReactionPending={reactionMutation.isPending}
          highlighted={false}
        />
        {selectedThread.replies.map((reply) => (
          <MessageRow
            key={reply.id}
            message={reply}
            currentUserId={user?.id}
            onOpenThread={setSelectedThreadId}
            onToggleReaction={(messageId, emoji) => reactionMutation.mutate({ messageId, emoji })}
            isReactionPending={reactionMutation.isPending}
            highlighted={false}
            compact
          />
        ))}
      </div>

      <div className="border-t p-3">
        <MessageComposer
          value={replyBody}
          onValueChange={setReplyBody}
          files={replyFiles}
          onAddFiles={(files) =>
            setReplyFiles((current) => [
              ...current,
              ...files.filter((f) => !current.some((e) => e.name === f.name)),
            ])
          }
          onRemoveFile={(name) =>
            setReplyFiles((current) => current.filter((f) => f.name !== name))
          }
          onSubmit={() =>
            sendMessageMutation.mutate({
              body: replyBody,
              parentMessageId: selectedThread.id,
              files: replyFiles,
              mode: 'thread',
            })
          }
          isPending={sendMessageMutation.isPending}
          suggestionEntries={suggestionEntries}
          placeholder="Reply in thread…"
          submitLabel="Reply"
        />
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
                  currentUserId={user?.id}
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
          <MessageComposer
            value={rootBody}
            onValueChange={setRootBody}
            files={rootFiles}
            onAddFiles={(files) =>
              setRootFiles((current) => [
                ...current,
                ...files.filter((f) => !current.some((e) => e.name === f.name)),
              ])
            }
            onRemoveFile={(name) =>
              setRootFiles((current) => current.filter((f) => f.name !== name))
            }
            onSubmit={() =>
              sendMessageMutation.mutate({
                body: rootBody,
                files: rootFiles,
                mode: 'root',
              })
            }
            isPending={sendMessageMutation.isPending}
            suggestionEntries={suggestionEntries}
            placeholder={`Message #${channel.name}`}
            submitLabel="Send"
          />
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {audience.length} {audience.length === 1 ? 'person' : 'people'} can see this channel · Cmd/Ctrl + Enter to send
          </p>
        </div>
      </div>
    </ClubWorkspace>
  );
}

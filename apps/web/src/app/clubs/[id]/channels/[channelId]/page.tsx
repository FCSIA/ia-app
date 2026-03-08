'use client';

import { use, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Hash,
  ImageIcon,
  Lock,
  MessageSquareText,
  Paperclip,
  Reply,
  Search,
  Send,
  Sparkles,
  Users2,
  X,
} from 'lucide-react';
import type {
  ChatAttachmentUploadResponse,
  ClubChannelMessage,
  ClubChannelMessageAttachment,
  ClubDetail,
} from '@ia/contracts/clubs';
import { AppShell } from '@/components/layout/AppShell';
import { HeroBand, HeroStat, PageFrame } from '@/components/layout/page-frame';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { MentionBody } from '@/components/clubs/mention-body';
import { fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { clubsApi, toApiUrl, uploadsApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
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
    ...message.attachments.map((attachment) => attachment.fileName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function AttachmentGallery({
  attachments,
}: {
  attachments: ClubChannelMessageAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
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
              className="group block overflow-hidden rounded-3xl border border-border/70 bg-muted/20"
            >
              <img
                src={href}
                alt={attachment.fileName}
                className="h-56 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{attachment.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {attachment.mimeType || 'image'} {sizeLabel ? `· ${sizeLabel}` : ''}
                  </p>
                </div>
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
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
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 transition hover:border-orange-500/25 hover:bg-orange-500/[0.05]"
          >
            <div className="flex size-10 items-center justify-center rounded-2xl bg-background">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{attachment.fileName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {attachment.mimeType || 'file'} {sizeLabel ? `· ${sizeLabel}` : ''}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function ReactionBar({
  message,
  onToggleReaction,
  isPending,
}: {
  message: ClubChannelMessage;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {message.reactions.map((reaction) => (
        <Button
          key={`${message.id}-${reaction.emoji}`}
          variant="outline"
          size="sm"
          className={cn(
            'h-8 rounded-full px-3 text-xs',
            reaction.reactedByCurrentUser &&
            'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-200',
          )}
          disabled={isPending}
          onClick={() => onToggleReaction(message.id, reaction.emoji)}
        >
          <span className="mr-1">{reaction.emoji}</span>
          {reaction.count}
        </Button>
      ))}
      <div className="ml-auto flex flex-wrap gap-1">
        {QUICK_REACTIONS.map((emoji) => (
          <Button
            key={`${message.id}-${emoji}-quick`}
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2 text-base"
            disabled={isPending}
            onClick={() => onToggleReaction(message.id, emoji)}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </div>
  );
}

function InlineReplyPreview({
  replies,
  currentUserId,
  onOpenThread,
  onToggleReaction,
  isReactionPending,
  highlightedIds,
}: {
  replies: ClubChannelMessage[];
  currentUserId?: string;
  onOpenThread: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isReactionPending: boolean;
  highlightedIds: Set<string>;
}) {
  if (replies.length === 0) return null;

  return (
    <div className="mt-4 space-y-3 rounded-3xl border border-border/70 bg-muted/15 p-3">
      {replies.slice(0, 2).map((reply) => (
        <MessageCard
          key={reply.id}
          message={reply}
          currentUserId={currentUserId}
          onOpenThread={onOpenThread}
          onToggleReaction={onToggleReaction}
          isReactionPending={isReactionPending}
          highlighted={highlightedIds.has(reply.id)}
          compact
        />
      ))}
      {replies.length > 2 ? (
        <Button
          variant="ghost"
          className="w-full justify-start rounded-2xl text-sm text-muted-foreground"
          onClick={() => onOpenThread(replies[0]?.threadRootId || replies[0]?.id)}
        >
          View {replies.length - 2} more repl{replies.length - 2 === 1 ? 'y' : 'ies'}
        </Button>
      ) : null}
    </div>
  );
}

function MessageCard({
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
  const isOwn = message.author.id === currentUserId;

  return (
    <div
      className={cn(
        'flex gap-3',
        isOwn && !compact && 'justify-end',
      )}
    >
      {!isOwn || compact ? (
        <ClubAvatar person={message.author} className={compact ? 'size-8' : 'size-10'} />
      ) : null}
      <div
        className={cn(
          'w-full max-w-[90%] rounded-[28px] border px-4 py-3 shadow-sm transition',
          compact ? 'max-w-full rounded-[24px] bg-background/80' : '',
          isOwn && !compact
            ? 'border-orange-500/20 bg-orange-500/[0.08]'
            : 'border-border/70 bg-background/90',
          highlighted && 'border-orange-500/40 ring-2 ring-orange-500/10',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 text-xs text-muted-foreground',
            isOwn && !compact && 'justify-end',
          )}
        >
          <span className="font-semibold text-foreground">
            {isOwn && !compact ? 'You' : fullName(message.author)}
          </span>
          {message.author.uniqueId ? (
            <span className="font-mono">{message.author.uniqueId}</span>
          ) : null}
          <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
        </div>

        {message.body ? (
          <MentionBody
            body={message.body}
            className={cn('mt-3', isOwn && !compact && 'text-right')}
          />
        ) : null}

        <AttachmentGallery attachments={message.attachments} />

        {message.mentions.length > 0 ? (
          <div className={cn('mt-3 flex flex-wrap gap-2', isOwn && !compact && 'justify-end')}>
            {message.mentions.map((mention) => (
              <Badge key={mention.id} variant="outline" className="rounded-full text-[11px]">
                @{mention.token}
              </Badge>
            ))}
          </div>
        ) : null}

        <ReactionBar
          message={message}
          onToggleReaction={onToggleReaction}
          isPending={isReactionPending}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs text-muted-foreground"
            onClick={() => onOpenThread(message.threadRootId)}
          >
            <Reply className="mr-1 size-3.5" />
            {message.parentMessageId ? 'Open thread' : 'Reply in thread'}
          </Button>
          {!compact && message.replyCount > 0 ? (
            <Badge variant="secondary" className="rounded-full">
              {message.replyCount} repl{message.replyCount === 1 ? 'y' : 'ies'}
            </Badge>
          ) : null}
        </div>

      </div>
      {isOwn && !compact ? <ClubAvatar person={message.author} className="size-10" /> : null}
    </div>
  );
}

function MessageComposer({
  title,
  subtitle,
  value,
  onValueChange,
  files,
  onAddFiles,
  onRemoveFile,
  onSubmit,
  isPending,
  suggestionEntries,
  helperTokens,
  submitLabel,
}: {
  title: string;
  subtitle: string;
  value: string;
  onValueChange: (value: string) => void;
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  suggestionEntries: MentionSuggestion[];
  helperTokens: string[];
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

  return (
    <div className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {helperTokens.map((token) => (
            <Button
              key={token}
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const suffix = value.trim().length > 0 && !value.endsWith(' ') ? ' ' : '';
                onValueChange(`${value}${suffix}${token} `);
              }}
            >
              {token}
            </Button>
          ))}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {files.map((file) => (
            <Badge key={file.name} variant="outline" className="rounded-full px-3 py-1">
              <span className="max-w-52 truncate">{file.name}</span>
              <button
                type="button"
                className="ml-2 inline-flex"
                onClick={() => onRemoveFile(file.name)}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative mt-4">
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
          placeholder="Write a message, drop in files, and mention the right people..."
          rows={5}
          className="min-h-32 rounded-[1.5rem] border-border/70 bg-muted/10 p-4 shadow-none focus-visible:ring-0"
        />

        {mentionMatch ? (
          <div className="absolute inset-x-4 bottom-4 z-20 rounded-[1.5rem] border border-border/70 bg-popover/95 shadow-xl backdrop-blur">
            <Command className="rounded-3xl">
              <CommandList className="max-h-56">
                <CommandEmpty>No mention matches.</CommandEmpty>
                <CommandGroup heading="Suggestions">
                  {visibleSuggestions.map((suggestion) => (
                    <CommandItem
                      key={`${suggestion.kind}-${suggestion.token}`}
                      value={`${suggestion.token} ${suggestion.label}`}
                      onSelect={() => insertMention(suggestion.token)}
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            @{suggestion.token}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {suggestion.label}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="mr-2 size-4" />
            Attach
          </Button>
          <span>Mentions work with `@uniqueId`, built-ins, and custom tags.</span>
        </div>
        <Button
          className="rounded-2xl"
          disabled={isPending || (!value.trim() && files.length === 0)}
          onClick={onSubmit}
        >
          <Send className="mr-2 size-4" />
          {isPending ? 'Sending…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ChannelRail({
  clubId,
  channelId,
  channels,
}: {
  clubId: string;
  channelId: string;
  channels: ClubDetail['channels'];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Channels
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep the main lane clean. Push side discussion into threads.
        </p>
      </div>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {(channels ?? []).map((channel) => (
            <Link key={channel.id} href={`/clubs/${clubId}/channels/${channel.id}`} className="block">
              <div
                className={cn(
                  'rounded-[1.4rem] border px-4 py-3 transition',
                  channel.id === channelId
                    ? 'border-orange-500/35 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                    : 'border-border/70 bg-background/80 hover:border-orange-500/20 hover:bg-orange-500/[0.04]',
                )}
              >
                <div className="flex items-center gap-2">
                  {channel.isPrivate ? (
                    <Lock className="size-4 text-muted-foreground" />
                  ) : (
                    <Hash className="size-4 text-muted-foreground" />
                  )}
                  <p className="font-medium text-foreground">{channel.name}</p>
                </div>
                {channel.description ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {channel.description}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Badge variant="outline" className="rounded-full">
                    {channel.isPrivate ? 'Private' : 'Open'}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {channel._count?.messages ?? 0} messages
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChannelInfoPane({
  channel,
  audience,
  tags,
}: {
  channel: NonNullable<ClubDetail['channels']>[number];
  audience: ClubDetail['directory'];
  tags: ClubDetail['tags'];
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Channel rules</CardTitle>
          <CardDescription>
            Sponsors always retain visibility. Mentions notify only the visible audience for this channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            {channel.isPrivate
              ? 'This is a private channel with an explicitly selected member audience.'
              : 'This is a public club channel visible to the full club audience.'}
          </p>
          <p>Use threads for side discussions, quick reactions for lightweight feedback, and attachments for docs or screenshots.</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Visible people</CardTitle>
          <CardDescription>{audience.length} people can see this channel right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {audience.map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <ClubAvatar person={person} className="size-9" fallbackClassName="text-[11px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{fullName(person)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {person.uniqueId || person.kind}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Custom tags</CardTitle>
          <CardDescription>Reusable mention groups for the club roster.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tags?.length ? (
            tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-200"
              >
                @{tag.slug}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No custom tags yet.</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ThreadPane({
  thread,
  currentUserId,
  onOpenThread,
  onClose,
  onToggleReaction,
  isReactionPending,
  replyBody,
  onReplyBodyChange,
  replyFiles,
  onAddReplyFiles,
  onRemoveReplyFile,
  onSubmitReply,
  isSendingReply,
  suggestionEntries,
  helperTokens,
  fallbackInfo,
}: {
  thread: ClubChannelMessage | null;
  currentUserId?: string;
  onOpenThread: (messageId: string) => void;
  onClose: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  isReactionPending: boolean;
  replyBody: string;
  onReplyBodyChange: (value: string) => void;
  replyFiles: File[];
  onAddReplyFiles: (files: File[]) => void;
  onRemoveReplyFile: (name: string) => void;
  onSubmitReply: () => void;
  isSendingReply: boolean;
  suggestionEntries: MentionSuggestion[];
  helperTokens: string[];
  fallbackInfo: ReactNode;
}) {
  if (!thread) return <>{fallbackInfo}</>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Thread
          </p>
          <h3 className="mt-2 text-xl font-semibold text-foreground">
            {fullName(thread.author)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <MessageCard
            message={thread}
            currentUserId={currentUserId}
            onOpenThread={onOpenThread}
            onToggleReaction={onToggleReaction}
            isReactionPending={isReactionPending}
            highlighted={false}
          />
          {thread.replies.map((reply) => (
            <MessageCard
              key={reply.id}
              message={reply}
              currentUserId={currentUserId}
              onOpenThread={onOpenThread}
              onToggleReaction={onToggleReaction}
              isReactionPending={isReactionPending}
              highlighted={false}
              compact
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 p-4">
        <MessageComposer
          title="Reply in thread"
          subtitle="Replies stay grouped here so the main channel stays readable."
          value={replyBody}
          onValueChange={onReplyBodyChange}
          files={replyFiles}
          onAddFiles={onAddReplyFiles}
          onRemoveFile={onRemoveReplyFile}
          onSubmit={onSubmitReply}
          isPending={isSendingReply}
          suggestionEntries={suggestionEntries}
          helperTokens={helperTokens}
          submitLabel="Reply"
        />
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
  const user = getUser();
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
    queryFn: () => clubsApi.getOne(id).then((response) => response.data),
  });

  const { data: messages = [] } = useQuery<ClubChannelMessage[]>({
    queryKey: ['club-channel-messages', id, channelId],
    queryFn: () =>
      clubsApi.getChannelMessages(id, channelId).then((response) => response.data),
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
        attachments: uploadedAttachments.map((attachment: ChatAttachmentUploadResponse) => ({
          fileName: attachment.originalName,
          fileUrl: attachment.url,
          mimeType: attachment.mimeType,
          size: attachment.size,
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

    const explicitMemberIds = new Set(
      channel.memberships?.map((membership) => membership.userId) ?? [],
    );
    return club.directory.filter(
      (person) => person.kind === 'SPONSOR' || explicitMemberIds.has(person.id),
    );
  }, [channel, club]);

  const suggestionEntries = useMemo<MentionSuggestion[]>(() => {
    const builtIns: MentionSuggestion[] = [
      {
        token: 'all',
        label: 'Everyone in this channel',
        detail: 'Notify the full visible audience',
        kind: 'built-in',
      },
      {
        token: 'leaders',
        label: 'Club leaders',
        detail: 'Notify the channel-visible leaders',
        kind: 'built-in',
      },
      {
        token: 'sponsors',
        label: 'Teacher sponsors',
        detail: 'Notify all sponsors',
        kind: 'built-in',
      },
    ];

    const tags =
      club?.tags?.map((tag) => ({
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
        detail: person.clubRole ? `${person.kind} · ${person.clubRole}` : person.kind,
        kind: 'person' as const,
      }));

    return [...builtIns, ...tags, ...people];
  }, [audience, club?.tags]);

  const helperTokens = useMemo(() => {
    const base = ['@all', '@leaders', '@sponsors'];
    const tagTokens = (club?.tags ?? []).slice(0, 4).map((tag) => `@${tag.slug}`);
    return [...base, ...tagTokens];
  }, [club?.tags]);

  const flattenedMessages = useMemo(
    () =>
      messages.flatMap((message) => [
        message,
        ...message.replies.map((reply) => ({
          ...reply,
          threadRootId: message.id,
        })),
      ]),
    [messages],
  );

  const matchingMessageIds = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return new Set<string>();

    return new Set(
      flattenedMessages
        .filter((message) => getSearchableText(message).includes(query))
        .map((message) => message.id),
    );
  }, [deferredSearch, flattenedMessages]);

  const visibleMessages = useMemo(() => {
    if (matchingMessageIds.size === 0) return messages;

    return messages.filter(
      (message) =>
        matchingMessageIds.has(message.id) ||
        message.replies.some((reply) => matchingMessageIds.has(reply.id)),
    );
  }, [matchingMessageIds, messages]);

  const searchResults = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return [];

    return flattenedMessages
      .filter((message) => matchingMessageIds.has(message.id))
      .slice(0, 8);
  }, [deferredSearch, flattenedMessages, matchingMessageIds]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return messages.find((message) => message.id === selectedThreadId) ?? null;
  }, [messages, selectedThreadId]);

  if (!club || !channel) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">
          Channel not found or you do not have access.
        </div>
      </AppShell>
    );
  }

  const rail = <ChannelRail clubId={id} channelId={channelId} channels={club.channels} />;

  const infoPane = (
    <ChannelInfoPane channel={channel} audience={audience} tags={club.tags} />
  );

  const chatPane = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-200"
          >
            Live channel
          </Badge>
          <span className="text-sm text-muted-foreground">
            Threads, reactions, attachments, and mentions are all live here.
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">#{channel.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {channel.description || 'Conversation space for this club channel.'}
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages, files, or people"
              className="rounded-2xl pl-11"
            />
          </div>
        </div>

        {searchResults.length > 0 ? (
          <div className="mt-4 grid gap-2 xl:grid-cols-2">
            {searchResults.map((message) => (
              <button
                key={`search-${message.id}`}
                type="button"
                className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-left transition hover:border-orange-500/25 hover:bg-orange-500/[0.05]"
                onClick={() => setSelectedThreadId(message.threadRootId)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {fullName(message.author)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {message.body || message.attachments.map((attachment) => attachment.fileName).join(', ')}
                </p>
              </button>
            ))}
          </div>
        ) : deferredSearch.trim() ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            No matches in this channel.
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-[28rem] flex-1 bg-background">
        <div className="space-y-5 p-5">
          {visibleMessages.length > 0 ? (
            visibleMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                <MessageCard
                  message={message}
                  currentUserId={user?.id}
                  onOpenThread={setSelectedThreadId}
                  onToggleReaction={(messageId, emoji) =>
                    reactionMutation.mutate({ messageId, emoji })
                  }
                  isReactionPending={reactionMutation.isPending}
                  highlighted={matchingMessageIds.has(message.id)}
                />
                {message.replyCount > 0 ? (
                  <InlineReplyPreview
                    replies={message.replies}
                    currentUserId={user?.id}
                    onOpenThread={setSelectedThreadId}
                    onToggleReaction={(messageId, emoji) =>
                      reactionMutation.mutate({ messageId, emoji })
                    }
                    isReactionPending={reactionMutation.isPending}
                    highlightedIds={matchingMessageIds}
                  />
                ) : null}
              </div>
            ))
          ) : (
            <Empty className="rounded-3xl border-border/70 bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareText />
                </EmptyMedia>
                <EmptyTitle>No messages yet</EmptyTitle>
                <EmptyDescription>
                  Start the conversation in #{channel.name}. Mentions, files, threads, and reactions are ready.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 p-5">
        <MessageComposer
          title="Channel composer"
          subtitle="Use the main lane for announcements, then break side conversations into threads."
          value={rootBody}
          onValueChange={setRootBody}
          files={rootFiles}
          onAddFiles={(files) =>
            setRootFiles((current) => [...current, ...files.filter((file) => !current.some((entry) => entry.name === file.name))])
          }
          onRemoveFile={(name) =>
            setRootFiles((current) => current.filter((file) => file.name !== name))
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
          helperTokens={helperTokens}
          submitLabel="Send"
        />
      </div>
    </div>
  );

  const threadPane = (
    <ThreadPane
      thread={selectedThread}
      currentUserId={user?.id}
      onOpenThread={setSelectedThreadId}
      onClose={() => setSelectedThreadId(null)}
      onToggleReaction={(messageId, emoji) =>
        reactionMutation.mutate({ messageId, emoji })
      }
      isReactionPending={reactionMutation.isPending}
      replyBody={replyBody}
      onReplyBodyChange={setReplyBody}
      replyFiles={replyFiles}
      onAddReplyFiles={(files) =>
        setReplyFiles((current) => [...current, ...files.filter((file) => !current.some((entry) => entry.name === file.name))])
      }
      onRemoveReplyFile={(name) =>
        setReplyFiles((current) => current.filter((file) => file.name !== name))
      }
      onSubmitReply={() =>
        selectedThread
          ? sendMessageMutation.mutate({
            body: replyBody,
            parentMessageId: selectedThread.id,
            files: replyFiles,
            mode: 'thread',
          })
          : undefined
      }
      isSendingReply={sendMessageMutation.isPending}
      suggestionEntries={suggestionEntries}
      helperTokens={helperTokens}
      fallbackInfo={infoPane}
    />
  );

  return (
    <AppShell>
      <PageFrame className="max-w-[1720px]">
        <HeroBand
          badge={
            <>
              <Link
                href={`/clubs/${id}`}
                className="inline-flex w-fit items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
                Back to workspace
              </Link>
              <Badge className="rounded-full bg-primary/12 text-primary">
                {channel.isPrivate ? 'Private channel' : 'Open channel'}
              </Badge>
            </>
          }
          title={channel.name}
          description={channel.description || 'Conversation space for this club channel.'}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                {messages.length} threads
              </Badge>
              <Badge variant="outline" className="rounded-full">
                <Users2 className="mr-1 size-3" />
                {audience.length} visible
              </Badge>
            </div>
          }
          aside={
            <>
              <HeroStat
                label="Search"
                value={deferredSearch.trim() ? searchResults.length : 'Ready'}
                description="Search messages, files, and authors across the lane."
                icon={Search}
              />
              <HeroStat
                label="Threads"
                value={messages.length}
                description="Keep the main lane readable with side discussions in threads."
                icon={Reply}
              />
              <HeroStat
                label="Audience"
                value={audience.length}
                description="People who can currently see this channel."
                icon={Users2}
              />
              <HeroStat
                label="Capabilities"
                value="Live"
                description="Mentions, reactions, uploads, and thread replies are all active here."
                icon={Sparkles}
              />
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 shadow-sm border bg-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Conversation design</p>
              <p className="mt-2 text-base font-semibold text-foreground">Main lane first, threads second.</p>
              <p className="mt-1 text-sm text-muted-foreground">That keeps high-signal channel history readable even as side conversations branch off.</p>
            </Card>
            <Card className="p-4 shadow-sm border bg-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Audience control</p>
              <p className="mt-2 text-base font-semibold text-foreground">Private channels stay scoped without hiding from sponsors.</p>
              <p className="mt-1 text-sm text-muted-foreground">Faculty oversight remains guaranteed by policy rather than manual membership edits.</p>
            </Card>
            <Card className="p-4 shadow-sm border bg-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Message tools</p>
              <p className="mt-2 text-base font-semibold text-foreground">Drop files, react fast, and mention intelligently.</p>
              <p className="mt-1 text-sm text-muted-foreground">The composer is optimized for quick coordination, not generic comment boxes.</p>
            </Card>
          </div>
        </HeroBand>

        <div className="hidden xl:block">
          <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/80 shadow-xl shadow-primary/5">
            <ResizablePanelGroup orientation="horizontal" className="min-h-[76vh]">
              <ResizablePanel defaultSize={19} minSize={16}>
                {rail}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={53} minSize={38}>
                {chatPane}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={28} minSize={20}>
                {threadPane}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>

        <div className="space-y-6 xl:hidden">
          <Card className="rounded-[1.5rem] bg-card">{rail}</Card>
          <Card className="rounded-[1.5rem] bg-card">{chatPane}</Card>
          <Card className="rounded-[1.5rem] bg-card">{threadPane}</Card>
        </div>
      </PageFrame>
    </AppShell>
  );
}

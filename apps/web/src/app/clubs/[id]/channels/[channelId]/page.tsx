'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Hash,
  Lock,
  MessageSquareText,
  Send,
  Sparkles,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { ClubAvatar } from '@/components/clubs/club-avatar';
import { MentionBody } from '@/components/clubs/mention-body';
import { ClubChannelMessage, ClubDetail, fullName } from '@/components/clubs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { clubsApi } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
      </div>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {(channels ?? []).map((channel) => (
            <Link key={channel.id} href={`/clubs/${clubId}/channels/${channel.id}`} className="block">
              <div
                className={cn(
                  'rounded-2xl border px-4 py-3 transition',
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
      <Card className="rounded-3xl border-border/70 bg-background/85">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Channel rules</CardTitle>
          <CardDescription>
            Sponsors always retain visibility. Mentions notify only the visible audience for this channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>{channel.isPrivate ? 'This is a private channel with an explicitly selected member audience.' : 'This is a public club channel visible to the full club audience.'}</p>
          <p>Use `@all`, `@leaders`, `@sponsors`, or a custom tag to reach the right people quickly.</p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/70 bg-background/85">
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

      <Card className="rounded-3xl border-border/70 bg-background/85">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Custom tags</CardTitle>
          <CardDescription>Reusable mention groups for the club roster.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tags?.length ? (
            tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-200">
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

function ChatPane({
  messages,
  currentUserId,
  channelName,
  messageBody,
  onMessageBodyChange,
  onSend,
  isPending,
  helperTokens,
}: {
  messages: ClubChannelMessage[];
  currentUserId?: string;
  channelName: string;
  messageBody: string;
  onMessageBodyChange: (value: string) => void;
  onSend: () => void;
  isPending: boolean;
  helperTokens: string[];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-200">
            Live channel
          </Badge>
          <span className="text-sm text-muted-foreground">Mentions notify the visible audience</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">#{channelName}</h2>
      </div>

      <ScrollArea className="min-h-[28rem] flex-1">
        <div className="space-y-4 p-5">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwn = message.author.id === currentUserId;

              return (
                <div
                  key={message.id}
                  className={cn('flex gap-3', isOwn && 'justify-end')}
                >
                  {!isOwn ? <ClubAvatar person={message.author} className="size-10" /> : null}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-[28px] border px-4 py-3 shadow-sm',
                      isOwn
                        ? 'border-orange-500/20 bg-orange-500/[0.08]'
                        : 'border-border/70 bg-background/90',
                    )}
                  >
                    <div className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', isOwn && 'justify-end')}>
                      <span className="font-semibold text-foreground">
                        {isOwn ? 'You' : fullName(message.author)}
                      </span>
                      {message.author.uniqueId ? <span className="font-mono">{message.author.uniqueId}</span> : null}
                      <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                    </div>
                    <MentionBody body={message.body} className={cn('mt-3', isOwn && 'text-right')} />
                    {message.mentions.length > 0 ? (
                      <div className={cn('mt-3 flex flex-wrap gap-2', isOwn && 'justify-end')}>
                        {message.mentions.map((mention) => (
                          <Badge key={mention.id} variant="outline" className="rounded-full text-[11px]">
                            @{mention.token}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {isOwn ? <ClubAvatar person={message.author} className="size-10" /> : null}
                </div>
              );
            })
          ) : (
            <Empty className="rounded-3xl border-border/70 bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareText />
                </EmptyMedia>
                <EmptyTitle>No messages yet</EmptyTitle>
                <EmptyDescription>
                  Start the conversation in #{channelName}. Mentions like `@leaders` and `@sponsors` work here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {helperTokens.map((token) => (
            <Button
              key={token}
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const suffix = messageBody.trim().length > 0 && !messageBody.endsWith(' ') ? ' ' : '';
                onMessageBodyChange(`${messageBody}${suffix}${token} `);
              }}
            >
              {token}
            </Button>
          ))}
        </div>
        <div className="rounded-[28px] border border-border/70 bg-background/85 p-3 shadow-sm">
          <Textarea
            value={messageBody}
            onChange={(event) => onMessageBodyChange(event.target.value)}
            placeholder="Write a message, mention people, and coordinate the work..."
            rows={5}
            className="min-h-32 rounded-2xl border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Direct mentions also work with `@uniqueId`.
            </p>
            <Button className="rounded-2xl" disabled={isPending || !messageBody.trim()} onClick={onSend}>
              <Send className="mr-2 size-4" />
              {isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
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
  const [messageBody, setMessageBody] = useState('');

  const { data: club } = useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => clubsApi.getOne(id).then((response) => response.data),
  });

  const { data: messages = [] } = useQuery<ClubChannelMessage[]>({
    queryKey: ['club-channel-messages', id, channelId],
    queryFn: () => clubsApi.getChannelMessages(id, channelId).then((response) => response.data),
  });

  const postMutation = useMutation({
    mutationFn: () => clubsApi.postChannelMessage(id, channelId, messageBody.trim()),
    onSuccess: () => {
      setMessageBody('');
      queryClient.invalidateQueries({ queryKey: ['club-channel-messages', id, channelId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: any) => {
      toast({
        title: error.response?.data?.message || 'Failed to send message',
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

    const explicitMemberIds = new Set(channel.memberships?.map((membership) => membership.userId) ?? []);
    return club.directory.filter(
      (person) => person.kind === 'SPONSOR' || explicitMemberIds.has(person.id),
    );
  }, [channel, club]);

  const helperTokens = useMemo(() => {
    const base = ['@all', '@leaders', '@sponsors'];
    const tagTokens = (club?.tags ?? []).slice(0, 5).map((tag) => `@${tag.slug}`);
    return [...base, ...tagTokens];
  }, [club?.tags]);

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
  const chat = (
    <ChatPane
      messages={messages}
      currentUserId={user?.id}
      channelName={channel.name}
      messageBody={messageBody}
      onMessageBodyChange={setMessageBody}
      onSend={() => postMutation.mutate()}
      isPending={postMutation.isPending}
      helperTokens={helperTokens}
    />
  );
  const info = <ChannelInfoPane channel={channel} audience={audience} tags={club.tags} />;

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-orange-500/15 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_34%),linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.94))] p-6 shadow-[0_30px_80px_-44px_rgba(234,88,12,0.55)] dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_32%),linear-gradient(135deg,rgba(28,25,23,0.98),rgba(17,17,17,0.96))] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Link
                href={`/clubs/${id}`}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/65 px-4 py-2 text-sm text-foreground/75 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5"
              >
                <ArrowLeft className="size-4" />
                Back to workspace
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-200">
                  {channel.isPrivate ? 'Private channel' : 'Open channel'}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {messages.length} messages
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  <Users2 className="mr-1 size-3" />
                  {audience.length} visible
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {channel.isPrivate ? (
                  <Lock className="size-5 text-muted-foreground" />
                ) : (
                  <Hash className="size-5 text-muted-foreground" />
                )}
                <div>
                  <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground">
                    {channel.name}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-foreground/75">
                    {channel.description || 'Conversation space for this club channel.'}
                  </p>
                </div>
              </div>
            </div>

            <Card className="rounded-[28px] border-white/50 bg-white/75 dark:border-white/10 dark:bg-white/5 lg:max-w-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-orange-600" />
                  <p className="font-medium text-foreground">Modern channel flow</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  This layout keeps the rail, chat stream, and audience context visible at once. Sponsors stay present even in private channels so nothing becomes invisible to supervision.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="hidden xl:block">
          <div className="overflow-hidden rounded-[32px] border border-border/70 bg-background/80 shadow-xl shadow-orange-500/5">
            <ResizablePanelGroup direction="horizontal" className="min-h-[72vh]">
              <ResizablePanel defaultSize={22} minSize={18}>
                {rail}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={53} minSize={38}>
                {chat}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={20}>
                {info}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>

        <div className="space-y-6 xl:hidden">
          <Card className="rounded-[28px] border-border/70">{rail}</Card>
          <Card className="rounded-[28px] border-border/70">{chat}</Card>
          <Card className="rounded-[28px] border-border/70">{info}</Card>
        </div>
      </div>
    </AppShell>
  );
}

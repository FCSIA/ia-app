'use client';

import { displayName, nameSearchValues } from '~/apps/shared/user-name';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { ChannelDetailsSheet } from './_components/channel-details-sheet';
import { useMutation, usePaginatedQuery, useQuery } from '@/lib/convex-react';
import { X } from 'lucide-react';
import { DisclosureTitle } from '@/components/ui/pressable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { ChannelWhiteboard } from './_components/whiteboard/channel-whiteboard';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { isStudent } from '~/apps/shared/roles';
import { useClubId } from '@/app/clubs/club-route';
import { useTouchPrimary } from '@/hooks/use-touch-primary';
import type { ClubChannelMessage } from '@/components/clubs/types';
import { latestVisibleChatActivity } from '~/apps/shared/chat/activity';
import { firstUnreadChannelMessageId } from '~/apps/shared/chat/unread-boundary';
import { useChannelUnreadBoundary } from '@/hooks/use-channel-unread-boundary';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
  ChannelMessageComposer,
  type ChannelMentionSuggestion,
  type ChannelMessageComposerHandle,
} from '@/components/chat/channel-message-composer';
import { ClubChannelVisibilityIcon } from '@/components/clubs/channel-visibility';
import { ClubWorkspace } from '@/components/clubs/club-workspace';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { ChannelNotificationSettings } from '@/components/notifications/channel-notification-settings';
import { MediaPlaybackContext } from '@/hooks/use-media-visibility';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { copyText } from '@/lib/share';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { useToast } from '@/hooks/use-toast';
import { optimisticallyToggleMessageReaction } from '~/apps/shared/chat/optimistic-message';
import { isChatReaction } from '~/apps/shared/chat/protocol';
import { clubChannelViewQuery, parseClubChannelLink } from '~/apps/shared/routes';
import { FailedSends } from './_components/failed-send';
import { richBodyOf } from './_components/message-body';
import { ChannelSearch } from './_components/channel-search';
import {
  ImageViewer,
  ImageViewerContext,
  type ImageViewerRequest,
} from './_components/message-attachments';
import {
  MessageRow,
  DEFAULT_DOUBLE_TAP_REACTION,
} from './_components/message-row';
import { PinnedMessagesButton } from './_components/pinned-messages';
import {
  CHAT_SCROLL_BUTTON_CLASS,
  CHAT_SCROLL_EDGE_THRESHOLD,
  HistoryPagination,
  NewMessagesButton,
  ScrollToReplyTarget,
  TOUCH_TIMELINE_CLASS,
  shouldGroupMessages,
} from './_components/message-timeline';
import {
  TypingPresence,
  useTypingActivity,
} from './_components/typing-presence';
import { useChannelSend } from './_components/use-channel-send';
import { useMarkChannelRead } from './_components/use-mark-channel-read';
import { useFriendship } from '@/components/users/use-friendship';

export function ChannelWorkspace() {
  const params = useParams<{ channelId: string }>();
  const channelIdParam = params?.channelId;
  if (!channelIdParam) {
    throw new Error('Channel workspace requires a channel route parameter.');
  }
  const clubId = useClubId();
  const channelId = channelIdParam as Id<'clubChannels'>;
  const isTouchPrimary = useTouchPrimary();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The view lives in the URL so audit links and shares can open the board.
  const { whiteboardRequested, messageId: linkedMessageId } =
    parseClubChannelLink(searchParams);
  const setChannelView = (view: 'chat' | 'whiteboard') => {
    const query = clubChannelViewQuery(searchParams, { view });
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
  const [mentionContextRequested, setMentionContextRequested] = useState(false);
  const { typingActive, onTypingActivity, stopTyping } = useTypingActivity();
  const rootComposerRef = useRef<ChannelMessageComposerHandle>(null);
  const replyComposerRef = useRef<ChannelMessageComposerHandle>(null);
  const [imageViewer, setImageViewer] = useState<
    (ImageViewerRequest & { open: boolean }) | null
  >(null);

  // The workspace is intentionally persistent across channel navigation. Clear
  // state that belongs to the previous conversation without remounting the
  // navigation, panel layout, or outer composer surface.
  useEffect(() => {
    stopTyping();
    setEditingMessageId(null);
    setSelectedThreadId(null);
    setReplyingToMessageId(null);
    setJumpedToMessageId(null);
    setJumpRequestKey(0);
    setReportingMessageId(null);
    setReportReason('');
    friendship.reset();
    resetSending();
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pinnedResult = useQuery(api.clubs.channels.listPinned, {
    clubId,
    channelId,
  });
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

  const {
    sendingMode,
    savingEditId,
    failedSends,
    saveEdit,
    submitMessage,
    discardFailedSend,
    resetSending,
  } = useChannelSend({
    clubId,
    channelId,
    user,
    onBeforeSend: (mode) => {
      (mode === 'thread' ? replyComposerRef : rootComposerRef).current?.clear();
      if (mode === 'root') setReplyingToMessageId(null);
    },
    onEdited: () => setEditingMessageId(null),
  });
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
    user?.chatDoubleTapReaction && isChatReaction(user.chatDoubleTapReaction)
      ? user.chatDoubleTapReaction
      : DEFAULT_DOUBLE_TAP_REACTION;
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const submitReport = useMutation(
    api.moderation.reports.submitClubChannelMessage,
  );

  useMarkChannelRead({
    channelId,
    latestVisibleActivity,
    unreadBoundary,
    paused: showWhiteboard,
  });

  const renderFailedSends = (parentMessageId?: Id<'clubChannelMessages'>) =>
    user ? (
      <FailedSends
        failedSends={failedSends}
        channelId={channelId}
        parentMessageId={parentMessageId}
        user={user}
        delivered={parentMessageId ? threadReplies : timelineMessages}
        onRetry={(item) => void submitMessage(item.payload, item.identity)}
        onDiscard={discardFailedSend}
        onRefocus={() =>
          (parentMessageId ? replyComposerRef : rootComposerRef).current?.focus()
        }
      />
    ) : null;

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
            .filter((message) => isStudent(message.author.roles))
            .map((message) => message.author._id)
            .filter((userId) => userId !== user?._id),
        ),
      ].slice(0, 100),
    [flattenedMessages, user?._id],
  );
  const friendship = useFriendship({
    targetIds: friendshipTargetIds,
    enabled: isStudent(user?.roles),
  });
  const messagesById = useMemo(
    () => new Map(flattenedMessages.map((message) => [message._id, message])),
    [flattenedMessages],
  );
  const replyingToMessage = replyingToMessageId
    ? (messagesById.get(replyingToMessageId) ?? null)
    : null;

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
      messageId: reportingMessage._id,
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
            setReplyingToMessageId(messageId);
            setSelectedThreadId(null);
            // Synchronous, inside the tap or swipe, so iOS raises the keyboard.
            rootComposerRef.current?.focus();
          }}
          onJumpToReply={(messageId) => {
            setReplyingToMessageId(null);
            setJumpedToMessageId(messageId);
            setJumpRequestKey((key) => key + 1);
          }}
          onOpenThread={(threadId) => {
            setReplyingToMessageId(null);
            setSelectedThreadId(threadId);
          }}
          onToggleReaction={(messageId, emoji) =>
            void toggleReaction({ messageId, emoji })
          }
          onTogglePin={(messageId, pinned) =>
            void setPinned({ messageId, pinned })
          }
          onVotePoll={(messageId, optionId) =>
            void votePoll({ messageId, optionId })
          }
          onStartEdit={setEditingMessageId}
          onDelete={(messageId) =>
            void deleteMessage({ messageId }).then(() =>
              toast({ title: 'Message deleted' }),
            )
          }
          onReport={setReportingMessageId}
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
          canSendFriendRequest={isStudent(user?.roles)}
          friendshipStatus={friendship.statusByUserId.get(message.author._id)}
          onSendFriendRequest={(friendId) => void friendship.send(friendId)}
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
                  initialBodyRich={richBodyOf(message)}
                  onSubmit={(args) => void saveEdit(message._id, args)}
                />
              </div>
            ) : null
          }
          isEditing={isEditing}
          friendRequestPendingId={friendship.pendingId}
          replying={replyingToMessageId === message._id}
          jumpedTo={jumpedToMessageId === message._id}
          permissions={{
            post: channel?.viewerCanPost ?? true,
            pin: canPinMessages,
            moderate: canModerateMessages,
          }}
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
  const jumpToMessage = (
    messageId: Id<'clubChannelMessages'>,
    threadId?: Id<'clubChannelMessages'>,
  ) => {
    setChannelView('chat');
    setJumpedToMessageId(messageId);
    setJumpRequestKey((key) => key + 1);
    if (threadId) setSelectedThreadId(threadId);
  };

  // The channel's own controls follow its name, so they keep one edge with
  // the title instead of drifting against the global search (their old
  // position moved with the width of the account name).
  const title: ReactNode = (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <ClubChannelVisibilityIcon
          visibility={channel.visibility}
          className="shrink-0 text-muted-foreground"
        />
        <h1 className="truncate text-base font-semibold text-foreground">
          {channel.name}
        </h1>
      </div>
      {/* Phones: the title is the way into the channel's details. It dims the
          instant a finger lands and recovers on release, so the press reads
          before the sheet opens. */}
      <DisclosureTitle
        as="h1"
        aria-haspopup="dialog"
        aria-label={`#${channel.name} details`}
        onClick={() => setDetailsOpen(true)}
        className="flex-1 sm:hidden"
        icon={<ClubChannelVisibilityIcon visibility={channel.visibility} />}
        title={channel.name}
        subtitle={channel.description || undefined}
      />
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
      </div>
      <ChannelDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        clubId={clubId}
        channelId={channelId}
        channel={channel}
        pinnedMessages={pinnedMessages}
        pinnedHasMore={pinnedResult?.hasMore}
        onJump={jumpToMessage}
        whiteboard={
          whiteboardsEnabled
            ? {
                showing: showWhiteboard,
                onToggle: () =>
                  setChannelView(showWhiteboard ? 'chat' : 'whiteboard'),
              }
            : undefined
        }
      />
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
                    className={cn('w-full gap-0 px-1 py-2 md:px-4')}
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
                    {timelineMessages.length > 0 ? (
                      timelineMessages.map((message, index) => (
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
                                timelineMessages[index - 1],
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
                                ? displayName(replyingToMessage.author)
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
                          ? `Reply to ${displayName(replyingToMessage.author)}`
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

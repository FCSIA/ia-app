import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMutation, usePaginatedQuery, useQuery } from "@/lib/convex-react";
import {
  FolderOpen,
  Hash,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Search,
} from "lucide-react-native";
import {
  KeyboardGestureArea,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { AppDetailHeader } from "@/components/screen";
import { Empty, IconButton, useToast } from "@/components/ui";
import { useCurrentUser, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { AttachmentViewer } from "./attachment-viewer";
import { safeRemoteAttachmentUrl } from "./chat-attachments";
import { chatSafeAreaOffset } from "./chat-keyboard-layout";
import { ChatComposer } from "./composer";
import { MessageActionsSheet } from "./message-actions-sheet";
import {
  createClientMessageIdentity,
  optimisticallyInsertPostedMessage,
} from "~/apps/shared/chat/optimistic-message";
import { ChatTimeline } from "./timeline";
import { isPdfAttachment } from "./types";
import type {
  ChatAttachment,
  ChatMessage,
  ChatThread,
  ClubChatData,
  ClubMentionContext,
  QuickReaction,
} from "./types";
import { useChatComposer } from "./use-chat-composer";
import { useChatDraft } from "./use-chat-draft";
import { useManagedChatAttachments } from "./use-managed-chat-attachments";
import { normalizeReactionPayload } from "./quick-reactions";
import { chatMessageLengthError } from "./chat-markdown";
import type { ChatMentionSuggestion } from "./rich-chat-input";
import { buildChatMentionSuggestions } from "./mention-suggestions";
import { latestVisibleChatActivity } from "~/apps/shared/chat/activity";
import { dismissPresentedChannelNotificationsThrough } from "@/lib/push";

type ClubChatScreenProps = {
  clubId: string;
  channelId: string;
  threadRootId?: string;
};

const MESSAGE_PAGE_SIZE = 30;
const CHAT_INPUT_NATIVE_ID = "club-chat-composer";

export function ClubChatScreen({
  clubId,
  channelId,
  threadRootId,
}: ClubChatScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const user = useCurrentUser();
  const liveUser = useLiveCurrentUser();
  const {
    results,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.clubs.channels.getMessagePage,
    threadRootId
      ? "skip"
      : {
          clubId: clubId as Id<"clubs">,
          channelId: channelId as Id<"clubChannels">,
        },
    { initialNumItems: MESSAGE_PAGE_SIZE },
  );
  const rawThread = useQuery(
    api.clubs.channels.getThread,
    threadRootId
      ? {
          clubId: clubId as Id<"clubs">,
          channelId: channelId as Id<"clubChannels">,
          messageId: threadRootId as Id<"clubChannelMessages">,
        }
      : "skip",
  );
  const rawChannelContext = useQuery(
    api.clubs.channels.getConversationContext,
    {
      clubId: clubId as Id<"clubs">,
      channelId: channelId as Id<"clubChannels">,
    },
  );
  const [mentionContextRequested, setMentionContextRequested] = useState(false);
  const rawMentionContext = useQuery(
    api.clubs.channels.getMentionContext,
    mentionContextRequested
      ? {
          clubId: clubId as Id<"clubs">,
          channelId: channelId as Id<"clubChannels">,
        }
      : "skip",
  );
  const messages = useMemo(
    () =>
      paginationStatus === "LoadingFirstPage"
        ? undefined
        : ([...(results as ChatMessage[])].reverse() as ChatMessage[]),
    [paginationStatus, results],
  );
  const latestVisibleActivity = useMemo(
    () => latestVisibleChatActivity(messages),
    [messages],
  );
  const thread = rawThread as ChatThread | null | undefined;
  const channelContext = rawChannelContext as ClubChatData | null | undefined;
  const mentionContext = rawMentionContext as
    | ClubMentionContext
    | null
    | undefined;
  const postMessageMutation = useMutation(api.clubs.channels.postMessage);
  const postMessage = useMemo(
    () =>
      postMessageMutation.withOptimisticUpdate((localStore, args) => {
        if (!liveUser) return;
        optimisticallyInsertPostedMessage(localStore, args, {
          clubId: clubId as Id<"clubs">,
          author: liveUser,
        });
      }),
    [clubId, liveUser, postMessageMutation],
  );
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const reportMessage = useMutation(
    api.moderation.reports.submitClubChannelMessage,
  );
  const markChannelRead = useMutation(api.clubs.channels.markRead);
  const composer = useChatComposer();
  const attachments = useManagedChatAttachments();
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [viewedAttachment, setViewedAttachment] =
    useState<ChatAttachment | null>(null);
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [composerBaseHeight, setComposerBaseHeight] = useState(0);
  const composerBaseHeightRef = useRef(0);
  const extraContentPadding = useSharedValue(0);
  const pendingKeysRef = useRef(new Set<string>());
  const channel = channelContext?.channel;
  const canPost =
    channelContext === undefined ? undefined : !!channel?.viewerCanPost;
  const canCreatePoll = !!channelContext?.canCreatePolls;
  const canPinMessages = !!channelContext?.canPinMessages;
  const canModerateMessages = !!channelContext?.canModerateMessages;

  useEffect(() => {
    setMentionContextRequested(false);
  }, [channelId, clubId]);
  const lastMarkedActivityRef = useRef(0);
  const lastReadAttemptAtRef = useRef(0);
  const [isRouteFocused, setIsRouteFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsRouteFocused(true);
      return () => setIsRouteFocused(false);
    }, []),
  );

  useEffect(() => {
    lastMarkedActivityRef.current = 0;
    lastReadAttemptAtRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (threadRootId || !isRouteFocused || !latestVisibleActivity) return;

    const markVisibleActivityRead = () => {
      if (AppState.currentState !== "active") return;
      if (latestVisibleActivity.occurredAt <= lastMarkedActivityRef.current) return;

      const previousActivity = lastMarkedActivityRef.current;
      lastMarkedActivityRef.current = latestVisibleActivity.occurredAt;
      lastReadAttemptAtRef.current = Date.now();
      void markChannelRead({
        channelId: channelId as Id<"clubChannels">,
        throughMessageId: latestVisibleActivity.messageId as Id<"clubChannelMessages">,
      })
        .then(() =>
          dismissPresentedChannelNotificationsThrough({
            channelId,
            throughCreatedAt: latestVisibleActivity.occurredAt,
          }),
        )
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
    const timeout = setTimeout(markVisibleActivityRead, delay);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") markVisibleActivityRead();
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [channelId, isRouteFocused, latestVisibleActivity, markChannelRead, threadRootId]);
  const threadRoot = threadRootId
    ? thread === undefined
      ? undefined
      : (thread?.root ?? null)
    : undefined;
  const timelineMessages = threadRootId
    ? thread === undefined
      ? undefined
      : (thread?.replies ?? [])
    : messages;
  const liveActionMessage = useMemo(() => {
    if (!actionMessage) return null;
    if (threadRoot?._id === actionMessage._id) return threadRoot;
    return (
      timelineMessages?.find((message) => message._id === actionMessage._id) ??
      actionMessage
    );
  }, [actionMessage, threadRoot, timelineMessages]);
  const threadIsMissing = !!threadRootId && thread !== undefined && !thread;
  const canLoadOlder = !threadRootId && paginationStatus === "CanLoadMore";
  const isLoadingOlder = !threadRootId && paginationStatus === "LoadingMore";
  const composerPending = pendingActions.has("composer");
  // The composer is a normal-flow sibling, so its height already reduces the
  // timeline viewport. Only the safe-area correction belongs in the dynamic
  // KeyboardChatScrollView/KeyboardStickyView translation offset.
  const keyboardSafeAreaOffset = chatSafeAreaOffset(insets.bottom, spacing.sm);
  const draftEnabled =
    composer.mode.kind === "message" || composer.mode.kind === "reply";
  const draftThreadId =
    threadRootId ??
    (composer.mode.kind === "reply" ? composer.mode.target._id : null);
  const draftIdentity = useMemo(
    () =>
      liveUser?._id
        ? {
            userId: liveUser._id,
            clubId,
            channelId,
            threadId: draftThreadId,
          }
        : null,
    [channelId, clubId, draftThreadId, liveUser?._id],
  );
  const { clear: clearDraft, flush: flushDraft } = useChatDraft({
    identity: draftIdentity,
    enabled: draftEnabled,
    getRevision: composer.getDraftRevision,
    plainText: composer.draft,
    markdown: composer.markdownDraft,
    onRestore: composer.restoreDraft,
  });
  const mentionSuggestions = useMemo<ChatMentionSuggestion[]>(
    () => buildChatMentionSuggestions(mentionContext),
    [mentionContext],
  );

  const handleComposerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      const previousBaseHeight = composerBaseHeightRef.current;
      const baseHeight =
        previousBaseHeight === 0
          ? height
          : Math.min(previousBaseHeight, height);

      if (baseHeight !== previousBaseHeight) {
        composerBaseHeightRef.current = baseHeight;
        setComposerBaseHeight(baseHeight);
      }
      extraContentPadding.value = withTiming(Math.max(0, height - baseHeight), {
        duration: 180,
      });
    },
    [extraContentPadding],
  );

  const loadOlderMessages = useCallback(() => {
    if (paginationStatus === "CanLoadMore") loadMore(MESSAGE_PAGE_SIZE);
  }, [loadMore, paginationStatus]);

  const runPending = useCallback(
    async (
      key: string,
      operation: () => Promise<unknown>,
      errorTitle: string,
    ) => {
      if (pendingKeysRef.current.has(key)) return false;
      pendingKeysRef.current.add(key);
      setPendingActions(new Set(pendingKeysRef.current));
      try {
        await operation();
        return true;
      } catch (error) {
        showToast({
          title: errorTitle,
          body: errorMessage(error),
          tone: "warning",
        });
        return false;
      } finally {
        pendingKeysRef.current.delete(key);
        setPendingActions(new Set(pendingKeysRef.current));
      }
    },
    [showToast],
  );

  const submitComposer = useCallback(async () => {
    if (pendingKeysRef.current.has("composer")) return;
    const mode = composer.mode;
    const draft = composer.draft.trim();

    if (mode.kind === "edit") {
      if (!draft) return;
      const lengthError = chatMessageLengthError(draft, composer.markdownDraft);
      if (lengthError) {
        showToast({ title: lengthError, tone: "warning" });
        return;
      }
      const completed = await runPending(
        "composer",
        () =>
          updateMessage({
            messageId: mode.target._id as Id<"clubChannelMessages">,
            body: draft,
            bodyMarkdown: composer.markdownDraft.trim() || undefined,
          }),
        "Message wasn’t updated",
      );
      if (completed) {
        composer.reset();
        showToast({ title: "Message updated", tone: "success" });
      }
      return;
    }

    if (mode.kind === "report") {
      if (!draft) return;
      const completed = await runPending(
        "composer",
        () =>
          reportMessage({
            messageId: mode.target._id as Id<"clubChannelMessages">,
            reason: draft,
          }),
        "Report wasn’t sent",
      );
      if (completed) {
        composer.reset();
        showToast({
          title: "Report sent",
          body: "Moderators have been notified.",
          tone: "success",
        });
      }
      return;
    }

    if (canPost !== true) return;
    const pollOptions = composer.pollOptions
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (mode.kind === "poll" && pollOptions.length < 2) {
      showToast({ title: "Add at least two poll choices", tone: "warning" });
      return;
    }
    if (mode.kind !== "poll" && !draft && !attachments.hasReadyAttachments)
      return;
    if (mode.kind !== "poll") {
      const lengthError = chatMessageLengthError(draft, composer.markdownDraft);
      if (lengthError) {
        showToast({ title: lengthError, tone: "warning" });
        return;
      }
    }
    const parentMessageId = threadRootId
      ? (threadRootId as Id<"clubChannelMessages">)
      : mode.kind === "reply"
        ? (mode.target._id as Id<"clubChannelMessages">)
        : undefined;
    const clientIdentity = createClientMessageIdentity();
    const completed = await runPending(
      "composer",
      () =>
        postMessage({
          channelId: channelId as Id<"clubChannels">,
          body: draft,
          bodyMarkdown:
            mode.kind === "poll"
              ? undefined
              : composer.markdownDraft.trim() || undefined,
          parentMessageId,
          attachments:
            mode.kind === "poll" ? [] : attachments.readyAttachmentUploadIds,
          ...clientIdentity,
          pollQuestion:
            mode.kind === "poll" ? composer.pollQuestion.trim() : undefined,
          pollOptions:
            mode.kind === "poll"
              ? pollOptions.map((label, index) => ({
                  id: `option-${index + 1}`,
                  label,
                }))
              : undefined,
        }),
      mode.kind === "reply" || threadRootId
        ? "Reply wasn’t sent"
        : "Message wasn’t sent",
    );
    if (completed) {
      attachments.markAttachmentsConsumed();
      if (draftEnabled) await clearDraft();
      composer.reset();
    } else {
      await attachments.abandonAttachments();
    }
  }, [
    attachments.abandonAttachments,
    attachments.hasReadyAttachments,
    attachments.markAttachmentsConsumed,
    attachments.readyAttachmentUploadIds,
    canPost,
    channelId,
    clubId,
    composer,
    draftEnabled,
    clearDraft,
    postMessage,
    reportMessage,
    runPending,
    showToast,
    threadRootId,
    updateMessage,
  ]);

  const handleToggleReaction = useCallback(
    async (message: ChatMessage, emoji: QuickReaction) => {
      const reaction = normalizeReactionPayload(emoji);
      if (!reaction) {
        showToast({
          title: "Reaction wasn’t updated",
          body: "That reaction is no longer supported.",
          tone: "warning",
        });
        return;
      }
      await runPending(
        `reaction:${message._id}:${reaction}`,
        () =>
          toggleReaction({
            messageId: message._id as Id<"clubChannelMessages">,
            emoji: reaction,
          }),
        "Reaction wasn’t updated",
      );
    },
    [runPending, toggleReaction],
  );

  const handleVotePoll = useCallback(
    async (message: ChatMessage, optionId: string) => {
      await runPending(
        `poll:${message._id}`,
        () =>
          votePoll({
            messageId: message._id as Id<"clubChannelMessages">,
            optionId,
          }),
        "Vote wasn’t updated",
      );
    },
    [runPending, votePoll],
  );

  const handleTogglePin = useCallback(
    async (message: ChatMessage) => {
      setActionMessage(null);
      const completed = await runPending(
        `pin:${message._id}`,
        () =>
          setPinned({
            messageId: message._id as Id<"clubChannelMessages">,
            pinned: !message.isPinned,
          }),
        message.isPinned ? "Message wasn’t unpinned" : "Message wasn’t pinned",
      );
      if (completed)
        showToast({
          title: message.isPinned ? "Message unpinned" : "Message pinned",
          tone: "success",
        });
    },
    [runPending, setPinned, showToast],
  );

  const deleteSelectedMessage = useCallback(
    async (message: ChatMessage) => {
      const completed = await runPending(
        `delete:${message._id}`,
        () =>
          deleteMessage({
            messageId: message._id as Id<"clubChannelMessages">,
          }),
        "Message wasn’t deleted",
      );
      if (completed) showToast({ title: "Message deleted", tone: "success" });
    },
    [deleteMessage, runPending, showToast],
  );

  const confirmDelete = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      Alert.alert("Delete message?", "This cannot be undone.", [
        { text: "Keep message", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void deleteSelectedMessage(message),
        },
      ]);
    },
    [deleteSelectedMessage],
  );

  const startReply = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      void flushDraft().catch(() => {});
      void attachments.abandonAttachments();
      composer.startReply(message);
    },
    [attachments.abandonAttachments, composer.startReply, flushDraft],
  );

  const startEdit = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      void flushDraft().catch(() => {});
      void attachments.abandonAttachments();
      composer.startEdit(message);
    },
    [attachments.abandonAttachments, composer.startEdit, flushDraft],
  );

  const startReport = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      void flushDraft().catch(() => {});
      void attachments.abandonAttachments();
      composer.startReport(message);
    },
    [attachments.abandonAttachments, composer.startReport, flushDraft],
  );

  const resetComposer = useCallback(() => {
    void flushDraft().catch(() => {});
    void attachments.abandonAttachments();
    composer.reset();
  }, [attachments.abandonAttachments, composer.reset, flushDraft]);

  const startPoll = useCallback(() => {
    void flushDraft().catch(() => {});
    void attachments.abandonAttachments();
    composer.startPoll();
  }, [attachments.abandonAttachments, composer.startPoll, flushDraft]);

  const openThread = useCallback(
    (message: ChatMessage) => {
      router.push(
        `/clubs/${clubId}/channels/${channelId}/threads/${message._id}` as never,
      );
    },
    [channelId, clubId],
  );

  const openAttachment = useCallback(
    (attachment: ChatAttachment) => {
      if (!isPdfAttachment(attachment)) {
        setViewedAttachment(attachment);
        return;
      }

      const safeUrl = safeRemoteAttachmentUrl(attachment.fileUrl);
      if (!safeUrl) {
        setViewedAttachment(attachment);
        return;
      }

      void Linking.openURL(safeUrl).catch((error) => {
        setViewedAttachment(attachment);
        showToast({
          title: "PDF could not be opened",
          body: errorMessage(error),
          tone: "warning",
        });
      });
    },
    [showToast],
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: color("background") }}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={{ flex: 1, backgroundColor: color("background") }}>
        <View
          style={{
            zIndex: 2,
            borderBottomWidth: 1,
            borderBottomColor: color("border"),
            backgroundColor: color("background"),
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 760,
              alignSelf: "center",
              paddingHorizontal: spacing.sm,
            }}
          >
            <AppDetailHeader
              title={threadRootId ? "Thread" : (channel?.name ?? "Channel")}
              subtitle={threadRootId ? channel?.name : channelContext?.clubName}
              leading={
                <ChannelHeaderMark
                  thread={!!threadRootId}
                  visibility={channel?.visibility}
                />
              }
              action={
                threadRootId ? undefined : (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <IconButton
                      icon={Search}
                      label="Search channel"
                      size="xs"
                      variant="ghost"
                      onPress={() =>
                        router.push(
                          `/clubs/${clubId}/channels/${channelId}/search` as never,
                        )
                      }
                    />
                    <IconButton
                      icon={FolderOpen}
                      label="Shared files"
                      size="xs"
                      variant="ghost"
                      onPress={() =>
                        router.push(
                          `/clubs/${clubId}/shared?channelId=${channelId}` as never,
                        )
                      }
                    />
                  </View>
                )
              }
            />
          </View>
        </View>

        <KeyboardGestureArea
          enableSwipeToDismiss
          interpolator="ios"
          offset={composerBaseHeight}
          style={{ flex: 1 }}
          textInputNativeID={CHAT_INPUT_NATIVE_ID}
        >
          {threadIsMissing ? (
            <View
              style={{
                flex: 1,
                paddingHorizontal: spacing.lg,
                justifyContent: "center",
              }}
            >
              <Empty
                icon={MessageCircle}
                title="Thread unavailable"
                body="The original message may have been deleted."
              />
            </View>
          ) : (
            <ChatTimeline
              messages={timelineMessages}
              threadRoot={threadRoot}
              threadHasMoreReplies={thread?.hasMoreReplies}
              canPost={canPost}
              canLoadOlder={canLoadOlder}
              isLoadingOlder={isLoadingOlder}
              keyboardOffset={keyboardSafeAreaOffset}
              extraContentPadding={extraContentPadding}
              pendingActions={pendingActions}
              onLoadOlder={loadOlderMessages}
              onLongPress={setActionMessage}
              onReply={startReply}
              onOpenThread={openThread}
              onToggleReaction={handleToggleReaction}
              onVotePoll={handleVotePoll}
              onOpenAttachment={openAttachment}
            />
          )}

          {!threadIsMissing ? (
            <KeyboardStickyView
              offset={{ closed: 0, opened: keyboardSafeAreaOffset }}
            >
              <ChatComposer
                composer={composer}
                canPost={canPost}
                isPending={composerPending}
                channelName={channel?.name}
                threadMode={!!threadRootId}
                canCreatePoll={canCreatePoll}
                attachments={attachments.items}
                attachmentPickerBusy={attachments.pickerBusy}
                canPickAttachments={attachments.canPickAttachments}
                hasReadyAttachments={attachments.hasReadyAttachments}
                attachmentSubmissionBlocked={
                  attachments.attachmentSubmissionBlocked
                }
                suggestions={mentionSuggestions}
                onMentionIntent={() => setMentionContextRequested(true)}
                inputNativeID={CHAT_INPUT_NATIVE_ID}
                onLayout={handleComposerLayout}
                onReset={resetComposer}
                onPickAttachments={() => void attachments.pickAttachments()}
                onRemoveAttachment={(localId) =>
                  void attachments.removeAttachment(localId)
                }
                onStartPoll={startPoll}
                onSubmit={() => void submitComposer()}
              />
            </KeyboardStickyView>
          ) : null}
        </KeyboardGestureArea>
      </View>

      <MessageActionsSheet
        message={liveActionMessage}
        currentUserId={user?._id}
        canPost={canPost}
        canPinMessages={canPinMessages}
        canModerateMessages={canModerateMessages}
        pendingActions={pendingActions}
        onClose={() => setActionMessage(null)}
        onReply={startReply}
        onEdit={startEdit}
        onReport={startReport}
        onDelete={confirmDelete}
        onTogglePin={handleTogglePin}
        onToggleReaction={handleToggleReaction}
      />
      <AttachmentViewer
        attachment={viewedAttachment}
        onClose={() => setViewedAttachment(null)}
      />
    </SafeAreaView>
  );
}

function ChannelHeaderMark({
  thread,
  visibility,
}: {
  thread: boolean;
  visibility?: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";
}) {
  const { color } = useTheme();
  const Icon = thread
    ? MessageCircle
    : visibility === "PRIVATE"
      ? LockKeyhole
      : visibility === "MEMBER_READONLY"
        ? Megaphone
        : Hash;
  return (
    <View
      style={{
        width: 24,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={18} color={color("mutedForeground")} strokeWidth={2} />
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Try again.";
}

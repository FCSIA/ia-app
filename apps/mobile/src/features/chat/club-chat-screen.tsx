import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Linking, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { MessageCircle } from "lucide-react-native";
import {
  KeyboardGestureArea,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { AppBackHeader } from "@/components/screen";
import { Empty, Txt, useToast } from "@/components/ui";
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
} from "./optimistic-message";
import { ChatTimeline } from "./timeline";
import { isPdfAttachment } from "./types";
import type {
  ChatAttachment,
  ChatMessage,
  ChatThread,
  ClubChatData,
  QuickReaction,
} from "./types";
import { useChatComposer } from "./use-chat-composer";
import { useChatDraft } from "./use-chat-draft";
import { useManagedChatAttachments } from "./use-managed-chat-attachments";
import { normalizeReactionPayload } from "./quick-reactions";
import { chatMessageLengthError } from "./chat-markdown";
import type { ChatMentionSuggestion } from "./rich-chat-input";

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
  const rawChannelContext = useQuery(api.clubs.channels.getConversationContext, {
    clubId: clubId as Id<"clubs">,
    channelId: channelId as Id<"clubChannels">,
  });
  const messages = useMemo(
    () =>
      paginationStatus === "LoadingFirstPage"
        ? undefined
        : ([...(results as ChatMessage[])].reverse() as ChatMessage[]),
    [paginationStatus, results],
  );
  const thread = rawThread as ChatThread | null | undefined;
  const channelContext = rawChannelContext as ClubChatData | null | undefined;
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
  const canPost = channelContext === undefined ? undefined : !!channel?.viewerCanPost;
  const canManage = !!channelContext?.canManageChannels;
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
  const keyboardSafeAreaOffset = chatSafeAreaOffset(
    insets.bottom,
    spacing.sm,
  );
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
  const mentionSuggestions = useMemo<ChatMentionSuggestion[]>(() => {
    const builtIns: ChatMentionSuggestion[] = [
      ...(canManage
        ? [
            {
              token: "all",
              label: "Everyone in this channel",
              displayText: "@all",
              detail: "Managers only",
            },
          ]
        : []),
    ];
    const people = (channelContext?.members ?? [])
      .map((person) => {
        const name =
          [person.firstName, person.lastName].filter(Boolean).join(" ") ||
          person.uniqueId;
        return {
          token: person.uniqueId,
          label: name,
          displayText: `@${name}`,
          detail: formatClubRole(person.role),
        };
      });
    return [...builtIns, ...people];
  }, [canManage, channelContext?.members]);

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
        <ChatHeader
          title={threadRootId ? "Thread" : `#${channel?.name ?? "channel"}`}
          description={
            threadRootId
              ? `#${channel?.name ?? "channel"}`
              : channelContext?.clubName
          }
        />

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
                canCreatePoll={canManage}
                attachments={attachments.items}
                attachmentPickerBusy={attachments.pickerBusy}
                canPickAttachments={attachments.canPickAttachments}
                hasReadyAttachments={attachments.hasReadyAttachments}
                attachmentSubmissionBlocked={
                  attachments.attachmentSubmissionBlocked
                }
                suggestions={mentionSuggestions}
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
        canManage={canManage}
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

function ChatHeader({
  title,
  description,
}: {
  title: string;
  description?: string | null;
}) {
  const { color } = useTheme();
  return (
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
          minHeight: 64,
          alignSelf: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <AppBackHeader forceVisible />
        <View style={{ minWidth: 0, flex: 1, gap: 1 }}>
          <Txt variant="section" numberOfLines={1}>
            {title}
          </Txt>
          {description ? (
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {description}
            </Txt>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Try again.";
}

function formatClubRole(role: "MEMBER" | "LEADER" | "SPONSOR") {
  return role === "SPONSOR"
    ? "Sponsor"
    : role === "LEADER"
      ? "Leader"
      : "Member";
}

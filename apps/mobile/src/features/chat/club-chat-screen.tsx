import { useCallback, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { MessageCircle } from "lucide-react-native";
import { AppBackHeader } from "@/components/screen";
import { Empty, Txt, useToast } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { ChatComposer } from "./composer";
import { MessageActionsSheet } from "./message-actions-sheet";
import { ChatTimeline } from "./timeline";
import type { ChatAttachment, ChatMessage, ClubChatData } from "./types";
import { useChatComposer } from "./use-chat-composer";

type ClubChatScreenProps = {
  clubId: string;
  channelId: string;
  threadRootId?: string;
};

export function ClubChatScreen({ clubId, channelId, threadRootId }: ClubChatScreenProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const user = useCurrentUser();
  const rawMessages = useQuery(api.clubs.channels.getMessages, {
    clubId: clubId as Id<"clubs">,
    channelId: channelId as Id<"clubChannels">,
  });
  const rawClub = useQuery(api.clubs.detail.get, { clubId: clubId as Id<"clubs"> });
  const messages = rawMessages as ChatMessage[] | undefined;
  const club = rawClub as ClubChatData | null | undefined;
  const postMessage = useMutation(api.clubs.channels.postMessage);
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const reportMessage = useMutation(api.moderation.reports.submit);
  const composer = useChatComposer();
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const channel = club?.channels?.find((item) => item._id === channelId);
  const canPost = club === undefined ? undefined : !!channel?.viewerCanPost;
  const canManage = !!club?.viewer?.canManageChannels;
  const threadRoot = threadRootId
    ? messages === undefined
      ? undefined
      : messages.find((message) => message._id === threadRootId) ?? null
    : undefined;
  const timelineMessages = threadRootId
    ? threadRoot === undefined
      ? undefined
      : threadRoot?.replies ?? []
    : messages;
  const threadIsMissing = !!threadRootId && messages !== undefined && !threadRoot;
  const composerPending = pendingAction === "composer";

  const runPending = useCallback(
    async (key: string, operation: () => Promise<unknown>, errorTitle: string) => {
      if (pendingRef.current) return false;
      pendingRef.current = true;
      setPendingAction(key);
      try {
        await operation();
        return true;
      } catch (error) {
        showToast({ title: errorTitle, body: errorMessage(error), tone: "warning" });
        return false;
      } finally {
        pendingRef.current = false;
        setPendingAction(null);
      }
    },
    [showToast],
  );

  const submitComposer = useCallback(async () => {
    const mode = composer.mode;
    const draft = composer.draft.trim();

    if (mode.kind === "edit") {
      if (!draft) return;
      const completed = await runPending(
        "composer",
        () => updateMessage({ messageId: mode.target._id as Id<"clubChannelMessages">, body: draft }),
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
            contentType: "clubChannelMessage",
            contentId: mode.target._id,
            reason: draft,
            reportedUserId: mode.target.authorId as Id<"users">,
            clubId: clubId as Id<"clubs">,
          }),
        "Report wasn’t sent",
      );
      if (completed) {
        composer.reset();
        showToast({ title: "Report sent", body: "Moderators have been notified.", tone: "success" });
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
    if (mode.kind !== "poll" && !draft) return;
    const parentMessageId = threadRootId
      ? (threadRootId as Id<"clubChannelMessages">)
      : mode.kind === "reply"
        ? (mode.target._id as Id<"clubChannelMessages">)
        : undefined;
    const completed = await runPending(
      "composer",
      () =>
        postMessage({
          channelId: channelId as Id<"clubChannels">,
          body: draft,
          parentMessageId,
          attachments: [],
          pollQuestion: mode.kind === "poll" ? composer.pollQuestion.trim() : undefined,
          pollOptions:
            mode.kind === "poll"
              ? pollOptions.map((label, index) => ({ id: `option-${index + 1}`, label }))
              : undefined,
        }),
      mode.kind === "reply" || threadRootId ? "Reply wasn’t sent" : "Message wasn’t sent",
    );
    if (completed) composer.reset();
  }, [
    canPost,
    channelId,
    clubId,
    composer,
    postMessage,
    reportMessage,
    runPending,
    showToast,
    threadRootId,
    updateMessage,
  ]);

  const handleToggleReaction = useCallback(
    async (message: ChatMessage, emoji: string) => {
      await runPending(
        `reaction:${message._id}:${emoji}`,
        () => toggleReaction({ messageId: message._id as Id<"clubChannelMessages">, emoji }),
        "Reaction wasn’t updated",
      );
    },
    [runPending, toggleReaction],
  );

  const handleVotePoll = useCallback(
    async (message: ChatMessage, optionId: string) => {
      await runPending(
        `poll:${message._id}`,
        () => votePoll({ messageId: message._id as Id<"clubChannelMessages">, optionId }),
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
        () => setPinned({ messageId: message._id as Id<"clubChannelMessages">, pinned: !message.isPinned }),
        message.isPinned ? "Message wasn’t unpinned" : "Message wasn’t pinned",
      );
      if (completed) showToast({ title: message.isPinned ? "Message unpinned" : "Message pinned", tone: "success" });
    },
    [runPending, setPinned, showToast],
  );

  const deleteSelectedMessage = useCallback(
    async (message: ChatMessage) => {
      const completed = await runPending(
        `delete:${message._id}`,
        () => deleteMessage({ messageId: message._id as Id<"clubChannelMessages"> }),
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
        { text: "Delete", style: "destructive", onPress: () => void deleteSelectedMessage(message) },
      ]);
    },
    [deleteSelectedMessage],
  );

  const startReply = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      composer.startReply(message);
    },
    [composer.startReply],
  );

  const startEdit = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      composer.startEdit(message);
    },
    [composer.startEdit],
  );

  const startReport = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      composer.startReport(message);
    },
    [composer.startReport],
  );

  const openThread = useCallback(
    (message: ChatMessage) => {
      router.push(`/clubs/${clubId}/channels/${channelId}/threads/${message._id}` as never);
    },
    [channelId, clubId],
  );

  const openAttachment = useCallback(
    (attachment: ChatAttachment) => {
      Linking.openURL(attachment.fileUrl).catch((error) =>
        showToast({ title: "Attachment couldn’t be opened", body: errorMessage(error), tone: "warning" }),
      );
    },
    [showToast],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={{ flex: 1, backgroundColor: color("background") }}
      >
        <ChatHeader
          title={threadRootId ? "Thread" : `#${channel?.name ?? "channel"}`}
          description={threadRootId ? `#${channel?.name ?? "channel"}` : channel?.description ?? club?.name}
        />

        {threadIsMissing ? (
          <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: "center" }}>
            <Empty icon={MessageCircle} title="Thread unavailable" body="The original message may have been deleted." />
          </View>
        ) : (
          <ChatTimeline
            messages={timelineMessages}
            threadRoot={threadRoot}
            canPost={canPost}
            pendingAction={pendingAction}
            onLongPress={setActionMessage}
            onOpenThread={openThread}
            onToggleReaction={handleToggleReaction}
            onVotePoll={handleVotePoll}
            onOpenAttachment={openAttachment}
          />
        )}

        {!threadIsMissing ? (
          <ChatComposer
            composer={composer}
            canPost={canPost}
            isPending={composerPending}
            bottomInset={insets.bottom}
            channelName={channel?.name}
            threadMode={!!threadRootId}
            onSubmit={() => void submitComposer()}
          />
        ) : null}
      </KeyboardAvoidingView>

      <MessageActionsSheet
        message={actionMessage}
        currentUserId={user?._id}
        canManage={canManage}
        pendingAction={pendingAction}
        onClose={() => setActionMessage(null)}
        onReply={startReply}
        onEdit={startEdit}
        onReport={startReport}
        onDelete={confirmDelete}
        onTogglePin={handleTogglePin}
        onToggleReaction={handleToggleReaction}
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
    <View style={{ borderBottomWidth: 1, borderBottomColor: color("border") }}>
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          minHeight: 58,
          alignSelf: "center",
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <AppBackHeader forceVisible />
        <View style={{ minWidth: 0, flex: 1 }}>
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

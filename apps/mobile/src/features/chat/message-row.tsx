import { memo } from "react";
import {
  Linking,
  Pressable,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Image } from "expo-image";
import { format } from "date-fns";
import {
  Check,
  Clock3,
  FileText,
  MessageCircle,
  Pin,
  RotateCcw,
} from "lucide-react-native";
import { Avatar, PressableScale, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { tapMedium } from "@/lib/haptics";
import { radii, spacing } from "@/lib/tokens";
import {
  normalizeReactionPayload,
  normalizeReactionSummaries,
  reactionDefinition,
} from "./quick-reactions";
import { RichMessageBody } from "./rich-message-body";
import {
  chatAuthorName,
  formatAttachmentSize,
  isImageAttachment,
  type ChatAttachment,
  type ChatMessage,
  type QuickReaction,
} from "./types";

type MessageRowProps = {
  message: ChatMessage;
  groupedWithPrevious: boolean;
  showReplyPreview: boolean;
  pendingActions: ReadonlySet<string>;
  onLongPress: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, reaction: QuickReaction) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => void;
  onOpenAttachment?: (attachment: ChatAttachment) => void;
  onRetry?: (message: ChatMessage) => void;
};

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  groupedWithPrevious,
  showReplyPreview,
  pendingActions,
  onLongPress,
  onOpenThread,
  onToggleReaction,
  onVotePoll,
  onOpenAttachment,
  onRetry,
}: MessageRowProps) {
  const { color } = useTheme();
  const authorName = chatAuthorName(message);
  const reactions = normalizeReactionSummaries(
    message.reactions?.filter((reaction) => reaction.count > 0) ?? [],
  );
  const hasThread = message.hasReplies ?? message.replyCount > 0;
  const replyCountIsExact = message.replyCountIsExact !== false;
  const isSending = message.deliveryState === "sending";
  const failedToSend = message.deliveryState === "failed";
  const openContextMenu = (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    void tapMedium();
    onLongPress(message);
  };

  return (
    <Pressable
      accessible={false}
      delayLongPress={280}
      onLongPress={openContextMenu}
      style={({ pressed }) => ({
        width: "100%",
        backgroundColor: message.isPinned
          ? color("secondary")
          : pressed
            ? color("muted")
            : "transparent",
        opacity: isSending ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.sm,
          paddingLeft: message.isPinned ? spacing.sm : spacing.md,
          paddingRight: spacing.md,
          paddingTop: groupedWithPrevious ? 2 : spacing.sm,
          paddingBottom:
            message.replyCount && showReplyPreview
              ? spacing.xs
              : groupedWithPrevious
                ? 2
                : spacing.xs,
          borderLeftWidth: message.isPinned ? 3 : 0,
          borderLeftColor: message.isPinned
            ? color("primary")
            : "transparent",
        }}
      >
        <View
          style={{
            width: 38,
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          {groupedWithPrevious ? null : (
            <Avatar
              uri={message.author?.avatarUrl}
              name={authorName}
              size={36}
            />
          )}
        </View>

        <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
          {!groupedWithPrevious ? (
            <View
              style={{
                minHeight: 20,
                flexDirection: "row",
                alignItems: "baseline",
                gap: spacing.xs,
              }}
            >
              <Txt
                variant="label"
                numberOfLines={1}
                style={{ minWidth: 0, flexShrink: 1, fontWeight: "800" }}
              >
                {authorName}
              </Txt>
              <Txt
                variant="caption"
                tone="muted"
                style={{ flexShrink: 0 }}
              >
                {format(new Date(message.createdAt), "h:mm a")}
              </Txt>
              {message.isPinned ? (
                <Pin
                  size={12}
                  color={color("primary")}
                  fill={color("primary")}
                />
              ) : null}
              {isSending ? (
                <Clock3 size={12} color={color("mutedForeground")} />
              ) : null}
            </View>
          ) : null}

        {message.body || message.bodyMarkdown ? (
          <RichMessageBody
            body={message.body}
            bodyMarkdown={message.bodyMarkdown}
          />
        ) : null}

        {message.attachments?.length ? (
          <View style={{ paddingTop: spacing.xs, gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.sm,
              }}
            >
              {message.attachments
                .filter(isImageAttachment)
                .map((attachment, index, imageAttachments) => (
                  <PressableScale
                    key={attachment._id}
                    accessibilityLabel={`Open image ${attachment.fileName}`}
                    accessibilityRole="link"
                    haptic={false}
                    onLongPress={openContextMenu}
                    onPress={() =>
                      onOpenAttachment
                        ? onOpenAttachment(attachment)
                        : void Linking.openURL(attachment.fileUrl)
                    }
                    style={{
                      width: imageAttachments.length === 1 ? "100%" : "48%",
                      maxWidth: imageAttachments.length === 1 ? 440 : 216,
                      aspectRatio: imageAttachments.length === 1 ? 16 / 10 : 1,
                      overflow: "hidden",
                      borderRadius: radii.md,
                      backgroundColor: color("muted"),
                    }}
                  >
                    <Image
                      source={{ uri: attachment.fileUrl }}
                      alt={attachment.fileName}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={140}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </PressableScale>
                ))}
            </View>
            {message.attachments
              .filter((attachment) => !isImageAttachment(attachment))
              .map((attachment) => (
                <FileAttachment
                  key={attachment._id}
                  attachment={attachment}
                  onLongPress={openContextMenu}
                  onPress={() =>
                    onOpenAttachment
                      ? onOpenAttachment(attachment)
                      : void Linking.openURL(attachment.fileUrl)
                  }
                />
              ))}
            {message.attachmentsTruncated ? (
              <Txt variant="caption" tone="muted">
                Showing the latest attachments
              </Txt>
            ) : null}
          </View>
        ) : null}

        {message.poll ? (
          <View
            style={{ maxWidth: 520, paddingTop: spacing.xs, gap: spacing.sm }}
          >
            <Txt style={{ fontWeight: "800" }}>{message.poll.question}</Txt>
            {message.poll.options.map((option) => {
              const percent = message.poll?.totalVotes
                ? Math.round((option.count / message.poll.totalVotes) * 100)
                : 0;
              const pending = pendingActions.has(`poll:${message._id}`);
              return (
                <PressableScale
                  key={option.id}
                  accessibilityLabel={`${option.label}, ${option.count} ${option.count === 1 ? "vote" : "votes"}${option.votedByCurrentUser ? ", selected" : ""}`}
                  accessibilityState={{
                    selected: option.votedByCurrentUser,
                    disabled: pending,
                  }}
                  disabled={pending}
                  haptic={false}
                  onLongPress={openContextMenu}
                  onPress={() => onVotePoll(message, option.id)}
                  style={{
                    minHeight: 44,
                    overflow: "hidden",
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: option.votedByCurrentUser
                      ? color("primary")
                      : color("border"),
                    backgroundColor: color("card"),
                    justifyContent: "center",
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${percent}%`,
                      backgroundColor: color("secondary"),
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Txt variant="label" numberOfLines={2} style={{ flex: 1 }}>
                      {option.label}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {message.poll?.votesTruncated ? "~" : ""}
                      {percent}%
                    </Txt>
                    {option.votedByCurrentUser ? (
                      <Check
                        size={15}
                        color={color("primary")}
                        strokeWidth={2.5}
                      />
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
            <Txt variant="caption" tone="muted">
              {message.poll.totalVotes}
              {message.poll.votesTruncated ? "+" : ""}{" "}
              {message.poll.totalVotes === 1 ? "vote" : "votes"}
            </Txt>
          </View>
        ) : null}

        {reactions.length ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing.xs,
              paddingTop: 2,
            }}
          >
            {reactions.map((reaction) => {
              const quickReaction = reactionDefinition(reaction.emoji);
              const payload = normalizeReactionPayload(reaction.emoji);
              const pending =
                !!payload &&
                pendingActions.has(`reaction:${message._id}:${payload}`);
              return (
                <PressableScale
                  key={reaction.emoji}
                  accessibilityLabel={`${quickReaction?.label ?? reaction.emoji}, ${reaction.count}`}
                  accessibilityState={{
                    selected: reaction.reactedByCurrentUser,
                    disabled: pending,
                  }}
                  disabled={pending || !payload}
                  haptic={false}
                  onLongPress={openContextMenu}
                  onPress={() => {
                    if (payload) onToggleReaction(message, payload);
                  }}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      minWidth: 40,
                      height: 32,
                      borderRadius: radii.pill,
                      backgroundColor: reaction.reactedByCurrentUser
                        ? color("secondary")
                        : color("muted"),
                      paddingHorizontal: spacing.sm,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing.xs,
                    }}
                  >
                    <Txt style={{ fontSize: 17, lineHeight: 20 }}>
                      {quickReaction?.glyph ?? reaction.emoji}
                    </Txt>
                    <Txt
                      variant="caption"
                      tone={
                        reaction.reactedByCurrentUser ? "primary" : "muted"
                      }
                      style={{ fontWeight: "800" }}
                    >
                      {reaction.count}
                      {reaction.countIsCapped ? "+" : ""}
                    </Txt>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {showReplyPreview && hasThread ? (
          <PressableScale
            accessibilityLabel={
              !replyCountIsExact
                ? "Open message thread"
                : `Open thread with ${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`
            }
            haptic={false}
            onLongPress={openContextMenu}
            onPress={() => onOpenThread(message)}
            style={{
              minHeight: 44,
              maxWidth: 520,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingTop: spacing.xs,
            }}
          >
            <MessageCircle size={16} color={color("primary")} />
            <Txt variant="label" tone="primary" style={{ fontWeight: "800" }}>
              {!replyCountIsExact
                ? "Thread"
                : `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`}
            </Txt>
            {message.latestReplyPreview || message.replies?.length ? (
              <Txt
                variant="caption"
                tone="muted"
                numberOfLines={1}
                style={{ minWidth: 0, flex: 1 }}
              >
                {message.latestReplyPreview?.body ||
                  message.replies?.[message.replies.length - 1]?.body ||
                  "Open thread"}
              </Txt>
            ) : null}
          </PressableScale>
        ) : null}
        {failedToSend ? (
          <PressableScale
            accessibilityLabel="Retry sending message"
            haptic={false}
            onLongPress={openContextMenu}
            onPress={() => onRetry?.(message)}
            style={{
              minHeight: 44,
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <RotateCcw size={15} color={color("destructive")} />
            <Txt
              variant="caption"
              tone="destructive"
              style={{ fontWeight: "700" }}
            >
              Not sent · Tap to retry
            </Txt>
          </PressableScale>
        ) : null}
        </View>
      </View>
    </Pressable>
  );
});

function FileAttachment({
  attachment,
  onLongPress,
  onPress,
}: {
  attachment: ChatAttachment;
  onLongPress: (event?: GestureResponderEvent) => void;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const size = formatAttachmentSize(attachment.size);
  return (
    <PressableScale
      accessibilityLabel={`Open file ${attachment.fileName}${size ? `, ${size}` : ""}`}
      accessibilityRole="link"
      haptic={false}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        minHeight: 48,
        maxWidth: 440,
        borderRadius: radii.md,
        backgroundColor: color("muted"),
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <FileText size={18} color={color("mutedForeground")} />
      <View style={{ minWidth: 0, flex: 1 }}>
        <Txt variant="label" numberOfLines={1}>
          {attachment.fileName}
        </Txt>
        {size ? (
          <Txt variant="caption" tone="muted">
            {size}
          </Txt>
        ) : null}
      </View>
    </PressableScale>
  );
}

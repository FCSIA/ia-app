import { memo } from "react";
import { Linking, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { format } from "date-fns";
import { Check, FileText, MessageCircle, Pin } from "lucide-react-native";
import { Avatar, PressableScale, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { QUICK_REACTIONS } from "./quick-reactions";
import {
  chatAuthorName,
  formatAttachmentSize,
  isImageAttachment,
  type ChatAttachment,
  type ChatMessage,
} from "./types";

type MessageRowProps = {
  message: ChatMessage;
  groupedWithPrevious: boolean;
  showReplyPreview: boolean;
  pendingAction?: string | null;
  onLongPress: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => void;
  onOpenAttachment?: (attachment: ChatAttachment) => void;
};

export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  groupedWithPrevious,
  showReplyPreview,
  pendingAction,
  onLongPress,
  onOpenThread,
  onToggleReaction,
  onVotePoll,
  onOpenAttachment,
}: MessageRowProps) {
  const { color } = useTheme();
  const authorName = chatAuthorName(message);
  const reactions = message.reactions?.filter((reaction) => reaction.count > 0) ?? [];

  return (
    <Pressable
      accessible
      accessibilityLabel={`${authorName}, ${format(new Date(message.createdAt), "h:mm a")}. ${message.body || "Attachment or poll"}`}
      accessibilityHint="Long press for message actions"
      delayLongPress={280}
      onLongPress={() => onLongPress(message)}
      style={({ pressed }) => ({
        width: "100%",
        maxWidth: 760,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: groupedWithPrevious ? 3 : spacing.md,
        paddingBottom: message.replyCount && showReplyPreview ? spacing.sm : groupedWithPrevious ? 3 : spacing.sm,
        backgroundColor: message.isPinned
          ? color("secondary")
          : pressed
            ? color("muted")
            : "transparent",
        borderLeftWidth: message.isPinned ? 2 : 0,
        borderLeftColor: message.isPinned ? color("primary") : "transparent",
      })}
    >
      <View style={{ width: 36, alignItems: "center", paddingTop: groupedWithPrevious ? 1 : 0 }}>
        {groupedWithPrevious ? (
          <Txt variant="caption" tone="muted" style={{ fontSize: 10, opacity: 0 }}>
            {format(new Date(message.createdAt), "h:mm")}
          </Txt>
        ) : (
          <Avatar uri={message.author?.avatarUrl} name={authorName} size={34} />
        )}
      </View>

      <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
        {!groupedWithPrevious ? (
          <View style={{ minHeight: 20, flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
            <Txt variant="label" numberOfLines={1} style={{ maxWidth: "72%", fontWeight: "800" }}>
              {authorName}
            </Txt>
            <Txt variant="caption" tone="muted">
              {format(new Date(message.createdAt), "h:mm a")}
            </Txt>
            {message.isPinned ? <Pin size={12} color={color("primary")} fill={color("primary")} /> : null}
          </View>
        ) : null}

        {message.body ? (
          <Txt selectable style={{ fontSize: 15, fontWeight: "500", lineHeight: 21 }}>
            {message.body}
          </Txt>
        ) : null}

        {message.attachments?.length ? (
          <View style={{ paddingTop: spacing.xs, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {message.attachments.filter(isImageAttachment).map((attachment, index, imageAttachments) => (
                <PressableScale
                  key={attachment._id}
                  accessibilityLabel={`Open image ${attachment.fileName}`}
                  accessibilityRole="link"
                  haptic={false}
                  onPress={() =>
                    onOpenAttachment ? onOpenAttachment(attachment) : void Linking.openURL(attachment.fileUrl)
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
            {message.attachments.filter((attachment) => !isImageAttachment(attachment)).map((attachment) => (
              <FileAttachment
                key={attachment._id}
                attachment={attachment}
                onPress={() =>
                  onOpenAttachment ? onOpenAttachment(attachment) : void Linking.openURL(attachment.fileUrl)
                }
              />
            ))}
          </View>
        ) : null}

        {message.poll ? (
          <View style={{ maxWidth: 520, paddingTop: spacing.xs, gap: spacing.sm }}>
            <Txt style={{ fontWeight: "800" }}>{message.poll.question}</Txt>
            {message.poll.options.map((option) => {
              const percent = message.poll?.totalVotes
                ? Math.round((option.count / message.poll.totalVotes) * 100)
                : 0;
              const pending = pendingAction === `poll:${message._id}`;
              return (
                <PressableScale
                  key={option.id}
                  accessibilityLabel={`${option.label}, ${option.count} ${option.count === 1 ? "vote" : "votes"}${option.votedByCurrentUser ? ", selected" : ""}`}
                  accessibilityState={{ selected: option.votedByCurrentUser, disabled: pending }}
                  disabled={pending}
                  haptic={false}
                  onPress={() => onVotePoll(message, option.id)}
                  style={{
                    minHeight: 44,
                    overflow: "hidden",
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: option.votedByCurrentUser ? color("primary") : color("border"),
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Txt variant="label" numberOfLines={2} style={{ flex: 1 }}>
                      {option.label}
                    </Txt>
                    <Txt variant="caption" tone="muted">
                      {percent}%
                    </Txt>
                    {option.votedByCurrentUser ? <Check size={15} color={color("primary")} strokeWidth={2.5} /> : null}
                  </View>
                </PressableScale>
              );
            })}
            <Txt variant="caption" tone="muted">
              {message.poll.totalVotes} {message.poll.totalVotes === 1 ? "vote" : "votes"}
            </Txt>
          </View>
        ) : null}

        {reactions.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs, paddingTop: 2 }}>
            {reactions.map((reaction) => {
              const quickReaction = QUICK_REACTIONS.find((entry) => entry.payload === reaction.emoji);
              const ReactionIcon = quickReaction?.icon;
              const pending = pendingAction === `reaction:${message._id}:${reaction.emoji}`;
              return (
                <PressableScale
                  key={reaction.emoji}
                  accessibilityLabel={`${quickReaction?.label ?? reaction.emoji}, ${reaction.count}`}
                  accessibilityState={{ selected: reaction.reactedByCurrentUser, disabled: pending }}
                  disabled={pending}
                  haptic={false}
                  onPress={() => onToggleReaction(message, reaction.emoji)}
                  style={{
                    minWidth: 38,
                    minHeight: 34,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: reaction.reactedByCurrentUser ? color("primary") : color("border"),
                    backgroundColor: reaction.reactedByCurrentUser ? color("secondary") : color("card"),
                    paddingHorizontal: spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                  }}
                >
                  {ReactionIcon ? (
                    <ReactionIcon
                      size={15}
                      color={reaction.reactedByCurrentUser ? color("primary") : color("mutedForeground")}
                      fill={reaction.emoji === "HEART" && reaction.reactedByCurrentUser ? color("primary") : "transparent"}
                    />
                  ) : (
                    <Txt variant="caption">{reaction.emoji}</Txt>
                  )}
                  <Txt variant="caption" tone={reaction.reactedByCurrentUser ? "primary" : "muted"} style={{ fontWeight: "800" }}>
                    {reaction.count}
                  </Txt>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {showReplyPreview && message.replyCount > 0 ? (
          <PressableScale
            accessibilityLabel={`Open thread with ${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`}
            haptic={false}
            onPress={() => onOpenThread(message)}
            style={{
              minHeight: 40,
              maxWidth: 520,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingTop: spacing.xs,
            }}
          >
            <MessageCircle size={16} color={color("primary")} />
            <Txt variant="label" tone="primary" style={{ fontWeight: "800" }}>
              {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
            </Txt>
            {message.replies?.length ? (
              <Txt variant="caption" tone="muted" numberOfLines={1} style={{ minWidth: 0, flex: 1 }}>
                {message.replies[message.replies.length - 1]?.body || "Open thread"}
              </Txt>
            ) : null}
          </PressableScale>
        ) : null}
      </View>
    </Pressable>
  );
});

function FileAttachment({ attachment, onPress }: { attachment: ChatAttachment; onPress: () => void }) {
  const { color } = useTheme();
  const size = formatAttachmentSize(attachment.size);
  return (
    <PressableScale
      accessibilityLabel={`Open file ${attachment.fileName}${size ? `, ${size}` : ""}`}
      accessibilityRole="link"
      haptic={false}
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

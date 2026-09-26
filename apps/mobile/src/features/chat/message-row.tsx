import { memo } from "react";
import {
  Linking,
  Pressable,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
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
import { DeveloperBadge } from "@/components/ui/developer-badge";
import { useTheme } from "@/lib/theme";
import { tapLight, tapMedium } from "@/lib/haptics";
import { radii, spacing } from "@/lib/tokens";
import {
  normalizeReactionPayload,
  normalizeReactionSummaries,
  reactionDefinition,
} from "./quick-reactions";
import { RichMessageBody } from "./rich-message-body";
import { ChatGif, ChatGifLinks } from "./chat-gif";
import { isGifAttachment } from "~/apps/shared/chat/gifs";
import {
  resistedReplySwipeDistance,
  shouldTriggerSwipeReply,
  SWIPE_REPLY_THRESHOLD,
} from "./swipe-reply";
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
  canReply: boolean;
  onLongPress: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
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
  canReply,
  onLongPress,
  onReply,
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
  const reduceMotion = useReducedMotion();
  const swipeX = useSharedValue(0);
  const replyThresholdReached = useSharedValue(false);
  const openContextMenu = (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    void tapMedium();
    onLongPress(message);
  };
  const swipeToReply = Gesture.Pan()
    .enabled(canReply && !isSending && !failedToSend)
    .activeOffsetX(-18)
    .failOffsetX(12)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      const distance = Math.max(0, -event.translationX);
      const resistedDistance = resistedReplySwipeDistance(distance);
      swipeX.value = -Math.min(resistedDistance, 92);

      const reached = distance >= SWIPE_REPLY_THRESHOLD;
      if (reached !== replyThresholdReached.value) {
        replyThresholdReached.value = reached;
        if (reached) scheduleOnRN(tapLight);
      }
    })
    .onEnd((event) => {
      const shouldReply = shouldTriggerSwipeReply(
        event.translationX,
        event.velocityX,
        replyThresholdReached.value,
      );
      if (shouldReply) scheduleOnRN(onReply, message);
      replyThresholdReached.value = false;
      swipeX.value = reduceMotion
        ? 0
        : withTiming(0, { duration: shouldReply ? 140 : 170 });
    })
    .onFinalize((_event, success) => {
      if (success) return;
      replyThresholdReached.value = false;
      if (swipeX.value !== 0) {
        swipeX.value = reduceMotion ? 0 : withTiming(0, { duration: 170 });
      }
    });
  const messageSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));
  const replyCueStyle = useAnimatedStyle(() => {
    const distance = -swipeX.value;
    return {
      opacity: reduceMotion
        ? distance >= SWIPE_REPLY_THRESHOLD
          ? 1
          : 0
        : interpolate(
            distance,
            [14, 44, SWIPE_REPLY_THRESHOLD],
            [0, 0.64, 1],
            "clamp",
          ),
      transform: [
        {
          scale: reduceMotion
            ? 1
            : interpolate(
                distance,
                [14, SWIPE_REPLY_THRESHOLD],
                [0.78, 1],
                "clamp",
              ),
        },
      ],
    };
  });

  return (
    <GestureDetector gesture={swipeToReply}>
      <View
        style={{
          width: "100%",
          overflow: "hidden",
          backgroundColor: color("background"),
        }}
      >
        {canReply && !isSending && !failedToSend ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: spacing.sm,
              top: 0,
              bottom: 0,
              width: 56,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={[
                {
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  backgroundColor: color("primary"),
                  alignItems: "center",
                  justifyContent: "center",
                },
                replyCueStyle,
              ]}
            >
              <MessageCircle
                size={20}
                color={color("primaryForeground")}
                strokeWidth={2.2}
              />
            </Animated.View>
          </View>
        ) : null}

        <Animated.View
          style={[
            { width: "100%", backgroundColor: color("background") },
            messageSwipeStyle,
          ]}
        >
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
                paddingLeft: message.isPinned ? 2 : spacing.sm,
                paddingRight: spacing.sm,
                paddingTop: groupedWithPrevious ? 0 : spacing.xs,
                paddingBottom:
                  message.replyCount && showReplyPreview
                    ? 2
                    : groupedWithPrevious
                      ? 0
                      : 2,
                borderLeftWidth: message.isPinned ? 3 : 0,
                borderLeftColor: message.isPinned
                  ? color("primary")
                  : "transparent",
              }}
            >
              <View
                style={{
                  width: 32,
                  flexShrink: 0,
                  alignItems: "center",
                }}
              >
                {groupedWithPrevious ? null : (
                  <Avatar
                    uri={message.author?.avatarUrl}
                    name={authorName}
                    size={30}
                  />
                )}
              </View>

              <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
                {!groupedWithPrevious ? (
                  <View
                    style={{
                      minHeight: 18,
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
                    <DeveloperBadge user={message.author} />
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

                <ChatGifLinks text={message.bodyMarkdown || message.body} />

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
                        .map((attachment, index, imageAttachments) => isGifAttachment(attachment) ? (
                          <ChatGif key={attachment._id} src={attachment.fileUrl} href={attachment.fileUrl} name={attachment.fileName} />
                        ) : (
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
                              width:
                                imageAttachments.length === 1 ? "100%" : "48%",
                              maxWidth:
                                imageAttachments.length === 1 ? 440 : 216,
                              aspectRatio:
                                imageAttachments.length === 1 ? 16 / 10 : 1,
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
                    style={{
                      maxWidth: 520,
                      paddingTop: spacing.xs,
                      gap: spacing.sm,
                    }}
                  >
                    <Txt style={{ fontWeight: "800" }}>
                      {message.poll.question}
                    </Txt>
                    {message.poll.options.map((option) => {
                      const percent = message.poll?.totalVotes
                        ? Math.round(
                            (option.count / message.poll.totalVotes) * 100,
                          )
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
                            <Txt
                              variant="label"
                              numberOfLines={2}
                              style={{ flex: 1 }}
                            >
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
                        pendingActions.has(
                          `reaction:${message._id}:${payload}`,
                        );
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
                                reaction.reactedByCurrentUser
                                  ? "primary"
                                  : "muted"
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
                    <Txt
                      variant="label"
                      tone="primary"
                      style={{ fontWeight: "800" }}
                    >
                      {!replyCountIsExact
                        ? "Thread"
                        : `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}`}
                    </Txt>
                    {message.latestReplyPreview ? (
                      <Txt
                        variant="caption"
                        tone="muted"
                        numberOfLines={1}
                        style={{ minWidth: 0, flex: 1 }}
                      >
                        {message.latestReplyPreview.body || "Open thread"}
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
        </Animated.View>
      </View>
    </GestureDetector>
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

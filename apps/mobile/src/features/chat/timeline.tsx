import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, type ViewToken } from "react-native";
import { FlashList, type FlashListRef, type ListRenderItemInfo } from "@shopify/flash-list";
import { format } from "date-fns";
import { ArrowDown, MessageCircle } from "lucide-react-native";
import { Empty, PressableScale, Skeleton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { ChatMessageRow } from "./message-row";
import type { ChatAttachment, ChatMessage } from "./types";

type TimelineRow =
  | { type: "date"; key: string; label: string }
  | { type: "thread-divider"; key: string; count: number }
  | { type: "message"; key: string; message: ChatMessage; groupedWithPrevious: boolean };

type ChatTimelineProps = {
  messages?: ChatMessage[];
  threadRoot?: ChatMessage | null;
  canPost?: boolean;
  pendingAction?: string | null;
  onLongPress: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => void;
  onOpenAttachment: (attachment: ChatAttachment) => void;
};

export function ChatTimeline({
  messages,
  threadRoot,
  canPost,
  pendingAction,
  onLongPress,
  onOpenThread,
  onToggleReaction,
  onVotePoll,
  onOpenAttachment,
}: ChatTimelineProps) {
  const { color } = useTheme();
  const listRef = useRef<FlashListRef<TimelineRow>>(null);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const previousMessageCount = useRef(0);
  const rows = useMemo(() => buildTimeline(messages ?? [], threadRoot), [messages, threadRoot]);
  const messageCount = useMemo(() => rows.filter((row) => row.type === "message").length, [rows]);
  const finalKey = rows.at(-1)?.key;
  const finalKeyRef = useRef(finalKey);

  useEffect(() => {
    finalKeyRef.current = finalKey;
  }, [finalKey]);

  useEffect(() => {
    const added = Math.max(0, messageCount - previousMessageCount.current);
    if (added && previousMessageCount.current > 0 && !isAtLiveEdge) {
      setUnseenCount((current) => current + added);
    }
    previousMessageCount.current = messageCount;
  }, [isAtLiveEdge, messageCount]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TimelineRow>) => {
      if (item.type === "date") return <DateMarker label={item.label} />;
      if (item.type === "thread-divider") return <ThreadDivider count={item.count} />;
      return (
        <ChatMessageRow
          message={item.message}
          groupedWithPrevious={item.groupedWithPrevious}
          showReplyPreview={!threadRoot}
          pendingAction={pendingAction}
          onLongPress={onLongPress}
          onOpenThread={onOpenThread}
          onToggleReaction={onToggleReaction}
          onVotePoll={onVotePoll}
          onOpenAttachment={onOpenAttachment}
        />
      );
    },
    [onLongPress, onOpenAttachment, onOpenThread, onToggleReaction, onVotePoll, pendingAction, threadRoot],
  );

  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<TimelineRow>[] }) => {
    const currentFinalKey = finalKeyRef.current;
    const atLiveEdge =
      !!currentFinalKey && viewableItems.some((token) => token.item?.key === currentFinalKey && token.isViewable);
    setIsAtLiveEdge(atLiveEdge);
    if (atLiveEdge) setUnseenCount(0);
  }, []);

  const scrollToLiveEdge = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setUnseenCount(0);
  }, []);

  if (messages === undefined) return <ChatTimelineSkeleton />;

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        ref={listRef}
        data={rows}
        renderItem={renderItem}
        keyExtractor={timelineKeyExtractor}
        getItemType={timelineItemType}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        maintainVisibleContentPosition={{
          autoscrollToBottomThreshold: 0.2,
          startRenderingFromBottom: true,
        }}
        onViewableItemsChanged={handleViewableItemsChanged}
        ListEmptyComponent={
          <Empty
            icon={MessageCircle}
            title="No messages yet"
            body={canPost === false ? "This channel is read-only." : "Start the conversation when you’re ready."}
          />
        }
      />

      {!isAtLiveEdge && rows.length ? (
        <PressableScale
          accessibilityLabel={unseenCount ? `Jump to ${unseenCount} new messages` : "Jump to latest message"}
          haptic={false}
          onPress={scrollToLiveEdge}
          style={{
            position: "absolute",
            right: spacing.md,
            bottom: spacing.md,
            minHeight: 42,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: color("border"),
            backgroundColor: color("card"),
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs,
          }}
        >
          <ArrowDown size={16} color={color("primary")} strokeWidth={2.4} />
          {unseenCount ? (
            <Txt variant="label" tone="primary" style={{ fontWeight: "800" }}>
              {unseenCount} new
            </Txt>
          ) : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

function timelineKeyExtractor(row: TimelineRow) {
  return row.key;
}

function timelineItemType(row: TimelineRow) {
  return row.type;
}

function buildTimeline(messages: ChatMessage[], threadRoot?: ChatMessage | null): TimelineRow[] {
  const sortedMessages = [...messages].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
  const source = threadRoot ? [threadRoot, ...sortedMessages] : sortedMessages;
  const rows: TimelineRow[] = [];
  let previousMessage: ChatMessage | null = null;
  let previousDateKey: string | null = null;

  source.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, "yyyy-MM-dd");

    if (threadRoot && index === 1) {
      rows.push({ type: "thread-divider", key: `thread:${threadRoot._id}`, count: sortedMessages.length });
      previousMessage = null;
    }

    if (dateKey !== previousDateKey) {
      rows.push({ type: "date", key: `date:${dateKey}`, label: formatDateLabel(date) });
      previousMessage = null;
      previousDateKey = dateKey;
    }

    const groupedWithPrevious = previousMessage
      ? previousMessage.authorId === message.authorId &&
        dateKey === format(new Date(previousMessage.createdAt), "yyyy-MM-dd") &&
        date.getTime() - new Date(previousMessage.createdAt).getTime() <= 5 * 60 * 1000
      : false;
    rows.push({ type: "message", key: `message:${message._id}`, message, groupedWithPrevious });
    previousMessage = message;
  });

  if (threadRoot && sortedMessages.length === 0) {
    rows.push({ type: "thread-divider", key: `thread:${threadRoot._id}`, count: 0 });
  }
  return rows;
}

function formatDateLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = format(date, "yyyy-MM-dd");
  if (key === format(today, "yyyy-MM-dd")) return "Today";
  if (key === format(yesterday, "yyyy-MM-dd")) return "Yesterday";
  return format(date, date.getFullYear() === today.getFullYear() ? "EEEE, MMM d" : "MMM d, yyyy");
}

const DateMarker = memo(function DateMarker({ label }: { label: string }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={{
        minHeight: 34,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View style={{ height: 1, flex: 1, backgroundColor: color("border") }} />
      <Txt variant="caption" tone="muted" style={{ fontWeight: "700" }}>
        {label}
      </Txt>
      <View style={{ height: 1, flex: 1, backgroundColor: color("border") }} />
    </View>
  );
});

const ThreadDivider = memo(function ThreadDivider({ count }: { count: number }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        minHeight: 44,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Txt variant="label" tone="muted" style={{ fontWeight: "800" }}>
        {count} {count === 1 ? "reply" : "replies"}
      </Txt>
      <View style={{ height: 1, flex: 1, backgroundColor: color("border") }} />
    </View>
  );
});

function ChatTimelineSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg, gap: spacing.lg }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={{ maxWidth: 760, width: "100%", alignSelf: "center", flexDirection: "row", gap: spacing.sm }}>
          <Skeleton style={{ width: 34, height: 34, borderRadius: radii.pill }} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton style={{ width: index % 2 ? "32%" : "44%", height: 14 }} />
            <Skeleton style={{ width: index % 2 ? "78%" : "92%", height: 18 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

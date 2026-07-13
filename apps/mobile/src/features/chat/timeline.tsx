import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  View,
  type ScrollViewProps,
} from "react-native";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
} from "@shopify/flash-list";
import { format } from "date-fns";
import { ArrowDown, MessageCircle } from "lucide-react-native";
import { KeyboardChatScrollView } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";
import { Empty, PressableScale, Skeleton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { ChatMessageRow } from "./message-row";
import type { ChatAttachment, ChatMessage } from "./types";

type TimelineRow =
  | { type: "date"; key: string; label: string }
  | { type: "thread-divider"; key: string; count: number }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      groupedWithPrevious: boolean;
    };

type ChatTimelineProps = {
  messages?: ChatMessage[];
  threadRoot?: ChatMessage | null;
  threadHasMoreReplies?: boolean;
  canPost?: boolean;
  canLoadOlder?: boolean;
  isLoadingOlder?: boolean;
  keyboardOffset: number;
  extraContentPadding: SharedValue<number>;
  pendingAction?: string | null;
  onLoadOlder?: () => void;
  onLongPress: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => void;
  onOpenAttachment: (attachment: ChatAttachment) => void;
};

type ChatScrollContextValue = {
  keyboardOffset: number;
  extraContentPadding: SharedValue<number>;
  onEndVisible: (visible: boolean) => void;
};

const ChatScrollContext = createContext<ChatScrollContextValue | null>(null);

const ClubChatScrollView = forwardRef<
  React.ElementRef<typeof KeyboardChatScrollView>,
  ScrollViewProps
>(function ClubChatScrollView(props, ref) {
  const context = useContext(ChatScrollContext);

  return (
    <KeyboardChatScrollView
      ref={ref}
      {...props}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      extraContentPadding={context?.extraContentPadding}
      keyboardDismissMode="interactive"
      keyboardLiftBehavior="whenAtEnd"
      offset={context?.keyboardOffset ?? 0}
      onEndVisible={context?.onEndVisible}
    />
  );
});

export function ChatTimeline({
  messages,
  threadRoot,
  threadHasMoreReplies = false,
  canPost,
  canLoadOlder = false,
  isLoadingOlder = false,
  keyboardOffset,
  extraContentPadding,
  pendingAction,
  onLoadOlder,
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
  const rows = useMemo(
    () => buildTimeline(messages ?? [], threadRoot),
    [messages, threadRoot],
  );
  const previousNewestMessageKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    const newestMessageKey = [...rows]
      .reverse()
      .find((row) => row.type === "message")?.key;
    const previousNewestKey = previousNewestMessageKey.current;
    if (previousNewestKey && !isAtLiveEdge) {
      const previousIndex = rows.findIndex(
        (row) => row.key === previousNewestKey,
      );
      if (previousIndex >= 0) {
        const addedAtLiveEdge = rows
          .slice(previousIndex + 1)
          .filter((row) => row.type === "message").length;
        if (addedAtLiveEdge)
          setUnseenCount((current) => current + addedAtLiveEdge);
      }
    }
    previousNewestMessageKey.current = newestMessageKey;
  }, [isAtLiveEdge, rows]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TimelineRow>) => {
      if (item.type === "date") return <DateMarker label={item.label} />;
      if (item.type === "thread-divider") {
        return (
          <ThreadDivider count={item.count} hasMore={threadHasMoreReplies} />
        );
      }
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
    [
      onLongPress,
      onOpenAttachment,
      onOpenThread,
      onToggleReaction,
      onVotePoll,
      pendingAction,
      threadHasMoreReplies,
      threadRoot,
    ],
  );

  const handleEndVisible = useCallback((visible: boolean) => {
    setIsAtLiveEdge(visible);
    if (visible) setUnseenCount(0);
  }, []);
  const scrollContext = useMemo(
    () => ({ keyboardOffset, extraContentPadding, onEndVisible: handleEndVisible }),
    [extraContentPadding, handleEndVisible, keyboardOffset],
  );

  const scrollToLiveEdge = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setUnseenCount(0);
  }, []);

  if (messages === undefined) return <ChatTimelineSkeleton />;

  return (
    <ChatScrollContext.Provider value={scrollContext}>
      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={rows}
          renderItem={renderItem}
          keyExtractor={timelineKeyExtractor}
          getItemType={timelineItemType}
          renderScrollComponent={ClubChatScrollView}
          contentContainerStyle={{
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{
            autoscrollToBottomThreshold: 0.2,
            startRenderingFromBottom: true,
          }}
          onStartReached={
            canLoadOlder && !isLoadingOlder ? onLoadOlder : undefined
          }
          onStartReachedThreshold={0.2}
          ListHeaderComponent={isLoadingOlder ? <OlderMessagesLoader /> : null}
          ListEmptyComponent={
            <Empty
              icon={MessageCircle}
              title="No messages yet"
              body={
                canPost === false
                  ? "This channel is read-only."
                  : "Start the conversation when you’re ready."
              }
            />
          }
        />

        {!isAtLiveEdge && rows.length ? (
          <PressableScale
            accessibilityLabel={
              unseenCount
                ? `Jump to ${unseenCount} new messages`
                : "Jump to latest message"
            }
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
    </ChatScrollContext.Provider>
  );
}

function timelineKeyExtractor(row: TimelineRow) {
  return row.key;
}

function timelineItemType(row: TimelineRow) {
  return row.type;
}

function buildTimeline(
  messages: ChatMessage[],
  threadRoot?: ChatMessage | null,
): TimelineRow[] {
  const sortedMessages = [...messages].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() -
      new Date(second.createdAt).getTime(),
  );
  const source = threadRoot ? [threadRoot, ...sortedMessages] : sortedMessages;
  const rows: TimelineRow[] = [];
  let previousMessage: ChatMessage | null = null;
  let previousDateKey: string | null = null;

  source.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dateKey = format(date, "yyyy-MM-dd");

    if (threadRoot && index === 1) {
      rows.push({
        type: "thread-divider",
        key: `thread:${threadRoot._id}`,
        count: sortedMessages.length,
      });
      previousMessage = null;
    }

    if (dateKey !== previousDateKey) {
      rows.push({
        type: "date",
        key: `date:${dateKey}`,
        label: formatDateLabel(date),
      });
      previousMessage = null;
      previousDateKey = dateKey;
    }

    const groupedWithPrevious = previousMessage
      ? previousMessage.authorId === message.authorId &&
        dateKey === format(new Date(previousMessage.createdAt), "yyyy-MM-dd") &&
        date.getTime() - new Date(previousMessage.createdAt).getTime() <=
          5 * 60 * 1000
      : false;
    rows.push({
      type: "message",
      key: `message:${message._id}`,
      message,
      groupedWithPrevious,
    });
    previousMessage = message;
  });

  if (threadRoot && sortedMessages.length === 0) {
    rows.push({
      type: "thread-divider",
      key: `thread:${threadRoot._id}`,
      count: 0,
    });
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
  return format(
    date,
    date.getFullYear() === today.getFullYear() ? "EEEE, MMM d" : "MMM d, yyyy",
  );
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

const ThreadDivider = memo(function ThreadDivider({
  count,
  hasMore,
}: {
  count: number;
  hasMore: boolean;
}) {
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
        {hasMore ? "Latest " : ""}
        {count}
        {hasMore ? "+" : ""} {count === 1 ? "reply" : "replies"}
      </Txt>
      <View style={{ height: 1, flex: 1, backgroundColor: color("border") }} />
    </View>
  );
});

function OlderMessagesLoader() {
  const { color } = useTheme();
  return (
    <View
      style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <ActivityIndicator size="small" color={color("mutedForeground")} />
    </View>
  );
}

function ChatTimelineSkeleton() {
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.lg,
        gap: spacing.lg,
      }}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={index}
          style={{
            maxWidth: 760,
            width: "100%",
            alignSelf: "center",
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <Skeleton
            style={{ width: 34, height: 34, borderRadius: radii.pill }}
          />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton
              style={{ width: index % 2 ? "32%" : "44%", height: 14 }}
            />
            <Skeleton
              style={{ width: index % 2 ? "78%" : "92%", height: 18 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

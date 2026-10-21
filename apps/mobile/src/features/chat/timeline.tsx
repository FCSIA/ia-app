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
import { ActivityIndicator, View, type ScrollViewProps } from "react-native";
import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
  type ViewToken,
} from "@shopify/flash-list";
import { ArrowDown, MessageCircle } from "lucide-react-native";
import { KeyboardChatScrollView } from "react-native-keyboard-controller";
import type { SharedValue } from "react-native-reanimated";
import { Empty, PressableScale, Skeleton, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { ChatMessageRow } from "./message-row";
import { buildTimelineRows, type TimelineRow } from "./timeline-layout";
import type { ChatAttachment, ChatMessage, QuickReaction } from "./types";
import { createMediaViewport, MediaVisibleContext, MediaViewportContext } from "@/lib/media-visibility";

type ChatTimelineProps = {
  messages?: ChatMessage[];
  mediaActive?: boolean;
  threadRoot?: ChatMessage | null;
  threadHasMoreReplies?: boolean;
  canPost?: boolean;
  canLoadOlder?: boolean;
  isLoadingOlder?: boolean;
  keyboardOffset: number;
  extraContentPadding: SharedValue<number>;
  pendingActions: ReadonlySet<string>;
  onLoadOlder?: () => void;
  onLongPress: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, reaction: QuickReaction) => void;
  onVotePoll: (message: ChatMessage, optionId: string) => void;
  onOpenAttachment: (attachment: ChatAttachment) => void;
};

type ChatScrollContextValue = {
  keyboardOffset: number;
  extraContentPadding: SharedValue<number>;
  onEndVisible: (visible: boolean) => void;
  onMediaScroll: () => void;
  onMediaInset: (bottom: number) => void;
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
      onScroll={(event) => { props.onScroll?.(event); context?.onMediaScroll(); }}
      onContentInsetChange={(insets) => context?.onMediaInset(insets.bottom)}
    />
  );
});

export function ChatTimeline({
  messages,
  mediaActive = true,
  threadRoot,
  threadHasMoreReplies = false,
  canPost,
  canLoadOlder = false,
  isLoadingOlder = false,
  keyboardOffset,
  extraContentPadding,
  pendingActions,
  onLoadOlder,
  onLongPress,
  onReply,
  onOpenThread,
  onToggleReaction,
  onVotePoll,
  onOpenAttachment,
}: ChatTimelineProps) {
  const { color } = useTheme();
  const listRef = useRef<FlashListRef<TimelineRow>>(null);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const gifViewport = useMemo(createMediaViewport, []);
  useEffect(() => () => gifViewport.dispose(), [gifViewport]);
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set());
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<TimelineRow>[] }) => {
    const next = new Set(viewableItems.filter((item) => item.isViewable).map((item) => item.key));
    setVisibleKeys((previous) => previous.size === next.size && [...next].every((key) => previous.has(key)) ? previous : next);
    gifViewport.check();
  }, [gifViewport]);
  const rows = useMemo(
    () => buildTimelineRows(messages ?? [], threadRoot),
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
    ({ item, target }: ListRenderItemInfo<TimelineRow>) => {
      if (item.type === "date") return <DateMarker label={item.label} />;
      if (item.type === "thread-divider") {
        return (
          <ThreadDivider count={item.count} hasMore={threadHasMoreReplies} />
        );
      }
      return (
        <MediaVisibleContext.Provider value={mediaActive && target === "Cell" && visibleKeys.has(item.key)}>
        <ChatMessageRow
          message={item.message}
          groupedWithPrevious={item.groupedWithPrevious}
          showReplyPreview={!threadRoot}
          pendingActions={pendingActions}
          canReply={canPost === true}
          onLongPress={onLongPress}
          onReply={onReply}
          onOpenThread={onOpenThread}
          onToggleReaction={onToggleReaction}
          onVotePoll={onVotePoll}
          onOpenAttachment={onOpenAttachment}
        />
        </MediaVisibleContext.Provider>
      );
    },
    [
      onLongPress,
      onReply,
      onOpenAttachment,
      onOpenThread,
      onToggleReaction,
      onVotePoll,
      pendingActions,
      mediaActive,
      visibleKeys,
      threadHasMoreReplies,
      threadRoot,
    ],
  );

  const handleEndVisible = useCallback((visible: boolean) => {
    setIsAtLiveEdge(visible);
    if (visible) setUnseenCount(0);
  }, []);
  const scrollContext = useMemo(
    () => ({
      keyboardOffset,
      extraContentPadding,
      onEndVisible: handleEndVisible,
      onMediaScroll: gifViewport.check,
      onMediaInset: gifViewport.setBottomInset,
    }),
    [extraContentPadding, handleEndVisible, keyboardOffset, gifViewport],
  );

  const scrollToLiveEdge = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
    setUnseenCount(0);
  }, []);

  if (messages === undefined) return <ChatTimelineSkeleton />;

  return (
    <ChatScrollContext.Provider value={scrollContext}>
      <MediaViewportContext.Provider value={gifViewport}>
      <View ref={gifViewport.setViewport} collapsable={false} onLayout={gifViewport.check} style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          style={{ flex: 1, width: "100%" }}
          data={rows}
          renderItem={renderItem}
          extraData={visibleKeys}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={GIF_VIEWABILITY_CONFIG}
          keyExtractor={timelineKeyExtractor}
          getItemType={timelineItemType}
          renderScrollComponent={ClubChatScrollView}
          contentContainerStyle={{
            paddingTop: 2,
            paddingBottom: spacing.sm,
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
      </MediaViewportContext.Provider>
    </ChatScrollContext.Provider>
  );
}

const GIF_VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 0, minimumViewTime: 100 };

function timelineKeyExtractor(row: TimelineRow) {
  return row.key;
}

function timelineItemType(row: TimelineRow) {
  return row.type;
}

const DateMarker = memo(function DateMarker({ label }: { label: string }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={{
        minHeight: 26,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: spacing.sm,
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
        minHeight: 32,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: spacing.sm,
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
        paddingTop: spacing.md,
        gap: spacing.md,
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

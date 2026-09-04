import { AppState, RefreshControl, View } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { AppHeader } from "@/components/app-header";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { PressableScale, Txt } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { openAppHref } from "@/lib/deep-links";
import { dismissPresentedNotificationsThrough } from "@/lib/push";
import { radii, spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  SCHOOL_ANNOUNCEMENT: "Announcement",
  CLUB_ANNOUNCEMENT: "Club announcement",
  CLUB_JOIN_REQUEST: "Club request",
  CLUB_CHANNEL_MESSAGE: "Club message",
  CLUB_CHANNEL_MENTION: "Mention",
  CLUB_CHANNEL_TAG_MENTION: "Mention",
  CLUB_CHANNEL_THREAD: "Thread reply",
  EVENT: "Event",
  FLEX_FRIDAY: "Flex Friday",
  CONTENT_MODERATED: "Moderation",
  FRIEND_REQUEST: "Friend request",
  FRIEND_SCHEDULE_CHANGE: "Schedule update",
};

export default function NotificationsScreen() {
  const notifications = useQuery(api.notifications.inbox.list, { limit: 50 });
  const markRead = useMutation(api.notifications.inbox.markRead);
  // `acknowledgeInbox` is deliberately server-batched against a fixed cutoff;
  // a device must never clear an alert that arrived after it opened the inbox.
  const acknowledgeInbox = useMutation(api.notifications.inbox.acknowledgeInbox);
  const { color } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isActive, setIsActive] = useState(AppState.currentState === "active");
  const acknowledgedUnreadKeyRef = useRef<string | null>(null);
  const acknowledgedThisFocusRef = useRef(false);
  const acknowledgingRef = useRef(false);
  const [acknowledgementRevision, setAcknowledgementRevision] = useState(0);
  const unread = (notifications ?? []).filter((item: any) => !item.isRead);
  const earlier = (notifications ?? []).filter((item: any) => item.isRead);
  const unreadKey = unread.map((item: any) => item.id).join(",");

  useFocusEffect(
    useCallback(() => {
      acknowledgedUnreadKeyRef.current = null;
      acknowledgedThisFocusRef.current = false;
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setIsActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused || !isActive || notifications === undefined) {
      return;
    }
    if (!unreadKey && acknowledgedThisFocusRef.current) return;
    if (acknowledgedUnreadKeyRef.current === unreadKey) return;
    if (acknowledgingRef.current) return;
    acknowledgedUnreadKeyRef.current = unreadKey;
    acknowledgingRef.current = true;

    let cancelled = false;
    let acknowledged = false;
    void acknowledgeInbox({})
      .then(async ({ cutoff }) => {
        acknowledged = true;
        acknowledgedThisFocusRef.current = true;
        if (!cancelled) {
          await dismissPresentedNotificationsThrough(cutoff);
        }
      })
      .catch(() => {
        acknowledgedUnreadKeyRef.current = null;
        // The inbox remains visibly unread and a later focus/data update can
        // retry. Automatic acknowledgement should not interrupt browsing.
      })
      .finally(() => {
        acknowledgingRef.current = false;
        if (!cancelled && acknowledged) {
          setAcknowledgementRevision((value) => value + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [acknowledgeInbox, acknowledgementRevision, isActive, isFocused, notifications, unreadKey]);

  function openNotification(item: any) {
    if (!item.isRead) void markRead({ ids: [item.id] });
    openAppHref(item.href);
  }

  return (
    <Screen
      header={<AppHeader title="Inbox" />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color("primary")}
          onRefresh={() => {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 550);
          }}
        />
      }
    >
      <DataBoundary data={notifications} emptyTitle="No notifications yet">
        {() => (
          <View style={{ gap: spacing.md }}>
            {unread.length ? (
              <NotificationSection
                title="New"
                items={unread}
                onOpen={openNotification}
              />
            ) : null}
            <NotificationSection title={unread.length ? "Earlier" : undefined} items={earlier} onOpen={openNotification} />
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function NotificationSection({
  title,
  items,
  onOpen,
}: {
  title?: string;
  items: any[];
  onOpen: (item: any) => void;
}) {
  if (!items.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt variant="section">{title}</Txt>
        </View>
      ) : null}
      {items.map((item) => (
        <NotificationRow key={item.id} item={item} onPress={() => onOpen(item)} />
      ))}
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: any; onPress: () => void }) {
  const { color, name: themeName } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={`${item.isRead ? "" : "Unread: "}${item.title}`}
      onPress={onPress}
    >
      <View
        style={{
          borderRadius: radii.lg,
          borderWidth: themeName === "high-contrast" ? 1 : 0,
          borderColor: color("border"),
          backgroundColor: item.isRead ? color("card") : color("secondary"),
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
        }}
      >
        <View
          accessibilityLabel={item.isRead ? undefined : "Unread"}
          style={{
            width: spacing.sm,
            height: spacing.sm,
            borderRadius: radii.pill,
            backgroundColor: item.isRead ? "transparent" : color("primary"),
          }}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Txt variant="overline" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {notificationCategory(item.category)}
            </Txt>
            <Txt variant="caption" tone="muted">{relativeTime(item.createdAt)}</Txt>
          </View>
          <Txt variant="body" numberOfLines={2} style={{ fontWeight: item.isRead ? "700" : "800" }}>
            {item.title}
          </Txt>
          <Txt variant="caption" tone="muted" numberOfLines={2}>{item.body}</Txt>
        </View>
        <ChevronRight size={18} color={color("mutedForeground")} />
      </View>
    </PressableScale>
  );
}

function notificationCategory(category: string) {
  return NOTIFICATION_CATEGORY_LABELS[category] ?? "Notification";
}

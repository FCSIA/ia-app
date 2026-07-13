import { RefreshControl, View } from "react-native";
import { useState } from "react";
import { ChevronRight } from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { AppHeader } from "@/components/app-header";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { PressableScale, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { openAppHref } from "@/lib/deep-links";
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
};

export default function NotificationsScreen() {
  const notifications = useQuery(api.notifications.inbox.list, { limit: 50 });
  const markRead = useMutation(api.notifications.inbox.markRead);
  const { showToast } = useToast();
  const { color } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const unread = (notifications ?? []).filter((item: any) => !item.isRead);
  const earlier = (notifications ?? []).filter((item: any) => item.isRead);

  function openNotification(item: any) {
    if (!item.isRead) void markRead({ ids: [item.id] });
    openAppHref(item.href);
  }

  async function markAllNew() {
    try {
      await markRead({ ids: unread.map((item: any) => item.id) });
      showToast({ title: "All caught up", tone: "success" });
    } catch {
      showToast({ title: "Notifications didn't update", body: "Try again.", tone: "warning" });
    }
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
                onMarkAllRead={() => void markAllNew()}
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
  onMarkAllRead,
}: {
  title?: string;
  items: any[];
  onOpen: (item: any) => void;
  onMarkAllRead?: () => void;
}) {
  if (!items.length) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt variant="section">{title}</Txt>
          {onMarkAllRead ? (
            <PressableScale
              accessibilityLabel="Mark all new notifications read"
              onPress={onMarkAllRead}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Txt variant="label" tone="primary">Mark all read</Txt>
            </PressableScale>
          ) : null}
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

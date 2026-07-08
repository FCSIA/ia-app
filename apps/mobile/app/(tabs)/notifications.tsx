import { RefreshControl, View } from "react-native";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AppHeader } from "@/components/app-header";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge, Card, ListRow, Section, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { openAppHref } from "@/lib/deep-links";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function NotificationsScreen() {
  const notifications = useQuery(api.notifications.inbox.list, { limit: 50 });
  const markRead = useMutation(api.notifications.inbox.markRead);
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const unread = (notifications ?? []).filter((item: any) => !item.isRead);
  const earlier = (notifications ?? []).filter((item: any) => item.isRead);

  function openNotification(item: any) {
    void markRead({ ids: [item.id] });
    openAppHref(item.href);
  }

  function markOneRead(item: any) {
    void markRead({ ids: [item.id] }).then(() => showToast({ title: "Marked read", tone: "success" }));
  }

  return (
    <Screen
      header={<AppHeader title="Inbox" subtitle="New and earlier notifications." />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 550);
          }}
        />
      }
    >
      <DataBoundary data={notifications} emptyTitle="No notifications">
        {() => (
          <View style={{ gap: spacing.md }}>
            {unread.length ? (
              <NotificationSection title="New" items={unread} onOpen={openNotification} onMarkRead={markOneRead} />
            ) : null}
            <NotificationSection title={unread.length ? "Earlier" : "Notifications"} items={earlier} onOpen={openNotification} onMarkRead={markOneRead} />
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
  onMarkRead,
}: {
  title: string;
  items: any[];
  onOpen: (item: any) => void;
  onMarkRead: (item: any) => void;
}) {
  if (!items.length) {
    return (
      <Card variant="flat">
        <Txt tone="muted" style={{ textAlign: "center" }}>Nothing here yet.</Txt>
      </Card>
    );
  }
  return (
    <Section title={title}>
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={item.title}
          subtitle={`${item.body} - ${relativeTime(item.createdAt)}`}
          onPress={() => onOpen(item)}
          trailing={
            item.isRead ? (
              <Badge label={item.category.replaceAll("_", " ")} color="gray" />
            ) : (
              <Badge label="New" color="orange" />
            )
          }
        />
      ))}
      {items.some((item) => !item.isRead) ? (
        <Txt variant="caption" tone="muted" onPress={() => items.filter((item) => !item.isRead).forEach(onMarkRead)}>
          Mark visible new items read
        </Txt>
      ) : null}
    </Section>
  );
}

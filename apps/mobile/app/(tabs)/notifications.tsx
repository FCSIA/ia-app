import { Alert, Pressable, Text, View } from "react-native";
import { useConvex, useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import { openAppHref } from "@/lib/deep-links";
import { registerNativePushToken } from "@/lib/push";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function NotificationsScreen() {
  const convex = useConvex();
  const notifications = useQuery(api.notifications.inbox.list, { limit: 50 });
  const preferences = useQuery(api.notifications.preferences.list, {});
  const markRead = useMutation(api.notifications.inbox.markRead);
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const { color } = useTheme();

  async function enablePush() {
    const result = await registerNativePushToken(convex);
    Alert.alert(result.ok ? "Push enabled" : "Push not enabled", result.ok ? "This device is registered." : result.reason);
  }

  return (
    <Screen title="Inbox" subtitle="Notifications and native push setup.">
      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Native push</Text>
        <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
          Enable notifications for announcements, club messages, events, and Flex Friday changes.
        </Text>
        <Button title="Enable push on this device" onPress={enablePush} />
      </Card>

      <DataBoundary data={notifications} emptyTitle="No notifications">
        {(items) => (
          <View style={{ gap: 10 }}>
            {items.map((item: any) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  void markRead({ ids: [item.id] });
                  openAppHref(item.href);
                }}
              >
                <Card style={{ gap: 8, opacity: item.isRead ? 0.72 : 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                    <Badge label={item.category.replaceAll("_", " ")} color={item.isRead ? "gray" : "orange"} />
                    <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{relativeTime(item.createdAt)}</Text>
                  </View>
                  <Text style={{ color: color("foreground"), fontSize: 16, fontWeight: "900" }}>{item.title}</Text>
                  <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>{item.body}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </DataBoundary>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Preferences</Text>
        {[
          "SCHOOL_ANNOUNCEMENT",
          "CLUB_ANNOUNCEMENT",
          "CLUB_CHANNEL_MESSAGE",
          "CLUB_CHANNEL_MENTION",
          "EVENT",
          "FLEX_FRIDAY",
          "FRIEND_REQUEST"
        ].map((category) => {
          const pref = preferences?.find((item: any) => item.category === category && item.scopeKey === "global");
          const enabled = pref ? pref.enabled : category !== "CLUB_CHANNEL_MESSAGE";
          return (
            <View key={category} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: color("foreground"), fontWeight: "800" }}>{category.replaceAll("_", " ")}</Text>
                <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{enabled ? "Push enabled" : "Off"}</Text>
              </View>
              <Button
                title={enabled ? "Off" : "On"}
                size="sm"
                variant={enabled ? "tertiary" : "secondary"}
                onPress={() =>
                  upsertPreference({
                    category: category as any,
                    enabled: !enabled,
                    scopeKey: "global",
                    level: !enabled ? "PUSH" : "OFF"
                  })
                }
              />
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

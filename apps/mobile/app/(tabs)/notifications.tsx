import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import { openAppHref } from "@/lib/deep-links";
import { nativePushUnavailableReason, registerNativePushToken } from "@/lib/push";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function NotificationsScreen() {
  const convex = useConvex();
  const notifications = useQuery(api.notifications.inbox.list, { limit: 50 });
  const preferences = useQuery(api.notifications.preferences.list, {});
  const nativeTokens = useQuery(api.notifications.pushExpo.listMine, {});
  const markRead = useMutation(api.notifications.inbox.markRead);
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const sendTestPush = useAction(api.notifications.pushExpo.sendTestToMe);
  const [pushLoading, setPushLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const pushUnavailableReason = nativePushUnavailableReason();
  const { color } = useTheme();

  async function enablePush() {
    setPushLoading(true);
    try {
      const result = await registerNativePushToken(convex);
      Alert.alert(result.ok ? "Push enabled" : "Push not enabled", result.ok ? "This device is registered." : result.reason);
    } finally {
      setPushLoading(false);
    }
  }

  async function sendTest() {
    setTestLoading(true);
    try {
      const result = await sendTestPush({
        title: "Innovation Academy",
        body: "Native push validation is connected.",
      });
      Alert.alert("Test push queued", `${result.sent} registered device${result.sent === 1 ? "" : "s"} targeted.`);
    } catch (error) {
      Alert.alert("Test push failed", error instanceof Error ? error.message : "Try again on a physical device.");
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <Screen title="Inbox" subtitle="Notifications and native push setup.">
      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Native push</Text>
        <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
          Enable notifications for announcements, club messages, events, and Flex Friday changes.
        </Text>
        {pushUnavailableReason ? (
          <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
            {pushUnavailableReason}
          </Text>
        ) : null}
        <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
          {nativeTokens === undefined
            ? "Checking registered devices..."
            : `${nativeTokens.length} registered device${nativeTokens.length === 1 ? "" : "s"}`}
        </Text>
        {nativeTokens?.map((token) => (
          <View key={token.token} style={{ gap: 2 }}>
            <Text style={{ color: color("foreground"), fontWeight: "800" }}>
              {token.deviceName ?? "This device"}
            </Text>
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>
              {token.platform.toUpperCase()} - updated {relativeTime(token.updatedAt)}
            </Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button
            title="Enable push on this device"
            onPress={enablePush}
            loading={pushLoading}
            disabled={!!pushUnavailableReason}
          />
          <Button
            title="Send test push"
            variant="secondary"
            onPress={sendTest}
            loading={testLoading}
            disabled={!!pushUnavailableReason || !nativeTokens?.length}
          />
        </View>
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

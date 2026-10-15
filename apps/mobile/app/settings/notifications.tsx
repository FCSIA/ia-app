import { useState } from "react";
import { useAction, useConvex, useMutation, useQuery } from "@/lib/convex-react";
import { Smartphone } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Button, ListRow, Section, Switch, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { nativePushUnavailableReason, registerNativePushToken } from "@/lib/push";
import { api } from "~/apps/convex/src/_generated/api";

const categories = [
  ["SCHOOL_ANNOUNCEMENT", "School announcements"],
  ["CLUB_ANNOUNCEMENT", "Club announcements"],
  ["CLUB_CHANNEL_MESSAGE", "Club messages"],
  ["CLUB_CHANNEL_MENTION", "Mentions"],
  ["EVENT", "Events"],
  ["FLEX_FRIDAY", "Flex Friday"],
  ["FRIEND_REQUEST", "Friend requests"],
  ["FRIEND_SCHEDULE_CHANGE", "Friend schedule changes"],
] as const;

export default function NotificationSettingsScreen() {
  const convex = useConvex();
  const preferences = useQuery(api.notifications.preferences.list, {});
  const nativeTokens = useQuery(api.notifications.pushExpo.listMine, {});
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const sendTestPush = useAction(api.notifications.pushExpo.sendTestToMe);
  const [pushLoading, setPushLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const pushUnavailableReason = nativePushUnavailableReason();
  const { showToast } = useToast();

  async function enablePush() {
    setPushLoading(true);
    try {
      const result = await registerNativePushToken(convex);
      showToast({
        title: result.ok ? "Push enabled" : "Push not enabled",
        body: result.ok ? "This device is registered." : result.reason,
        tone: result.ok ? "success" : "default",
      });
    } finally {
      setPushLoading(false);
    }
  }

  async function sendTest() {
    setTestLoading(true);
    try {
      const result = await sendTestPush({ title: "Innovation Academy", body: "Push notifications are connected." });
      showToast({ title: "Test sent", body: `${result.sent} device${result.sent === 1 ? "" : "s"} targeted.`, tone: "success" });
    } catch (error) {
      showToast({ title: "Test failed", body: error instanceof Error ? error.message : "Try again on a physical device.", tone: "warning" });
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <Screen title="Notifications">
      <Section title="This device">
        {pushUnavailableReason ? <Txt tone="muted">{pushUnavailableReason}</Txt> : null}
        {nativeTokens === undefined ? <Txt variant="caption" tone="muted">Checking registration…</Txt> : null}
        {nativeTokens?.map((token) => (
          <ListRow
            key={token.token}
            icon={Smartphone}
            title={token.deviceName ?? "This device"}
            subtitle={`${token.platform.toUpperCase()} · Updated ${relativeTime(token.updatedAt)}`}
          />
        ))}
        <Button title="Enable on this device" onPress={() => void enablePush()} loading={pushLoading} disabled={!!pushUnavailableReason} />
        <Button title="Send test" variant="secondary" onPress={() => void sendTest()} loading={testLoading} disabled={!!pushUnavailableReason || !nativeTokens?.length} />
      </Section>

      <Section title="Topics">
        {categories.map(([category, label]) => {
          const pref = preferences?.find((item: any) => item.category === category && item.scopeKey === "global");
          const enabled = pref ? pref.enabled : category !== "CLUB_CHANNEL_MESSAGE";
          return (
            <ListRow
              key={category}
              title={label}
              trailing={
                <Switch
                  label={`${label} notifications`}
                  value={enabled}
                  onValueChange={(next) =>
                    upsertPreference({
                      category: category as any,
                      enabled: next,
                      scopeKey: "global",
                      level: next ? "PUSH" : "OFF",
                    }).catch(() => showToast({ title: "Preference didn't update", body: "Try again.", tone: "warning" }))
                  }
                />
              }
            />
          );
        })}
      </Section>
    </Screen>
  );
}

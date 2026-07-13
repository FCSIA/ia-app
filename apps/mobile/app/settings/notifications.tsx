import { useState } from "react";
import { View } from "react-native";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { Screen } from "@/components/screen";
import { Button, Card, ListRow, Section, Switch, Txt, useToast } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { nativePushUnavailableReason, registerNativePushToken } from "@/lib/push";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const categories = [
  "SCHOOL_ANNOUNCEMENT",
  "CLUB_ANNOUNCEMENT",
  "CLUB_CHANNEL_MESSAGE",
  "CLUB_CHANNEL_MENTION",
  "CLUB_CHANNEL_TAG_MENTION",
  "CLUB_CHANNEL_THREAD",
  "EVENT",
  "FLEX_FRIDAY",
  "CONTENT_MODERATED",
  "FRIEND_REQUEST",
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
        body: result.ok
          ? `This device is registered and ${result.preferencesUpdated} alert preference${result.preferencesUpdated === 1 ? "" : "s"} activated.`
          : result.reason,
        tone: result.ok ? "success" : "default",
      });
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
      showToast({
        title: "Test push accepted by Expo",
        body: `${result.accepted} of ${result.targeted} registered device${result.targeted === 1 ? "" : "s"} accepted. Device delivery still needs physical-device validation.`,
        tone: result.accepted ? "success" : "default",
      });
    } catch (error) {
      showToast({ title: "Test push failed", body: error instanceof Error ? error.message : "Try again on a physical device." });
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <Screen title="Notifications" subtitle="Device registration and push preferences.">
      <Section title="Native push">
        <Card style={{ gap: spacing.md }}>
          <Txt tone="muted">Enable push delivery for your active announcements, club activity, events, Flex Friday, and friend alerts.</Txt>
          {pushUnavailableReason ? <Txt tone="muted">{pushUnavailableReason}</Txt> : null}
          <Txt variant="caption" tone="muted">
            {nativeTokens === undefined
              ? "Checking registered devices..."
              : `${nativeTokens.length} registered device${nativeTokens.length === 1 ? "" : "s"}`}
          </Txt>
          {nativeTokens?.map((token) => (
            <View key={token.token} style={{ gap: 2 }}>
              <Txt variant="label">{token.deviceName ?? "This device"}</Txt>
              <Txt variant="caption" tone="muted">
                {token.platform.toUpperCase()} - updated {relativeTime(token.updatedAt)}
              </Txt>
            </View>
          ))}
          <Button title="Enable push on this device" onPress={enablePush} loading={pushLoading} disabled={!!pushUnavailableReason} />
          <Button title="Send test push" variant="secondary" onPress={sendTest} loading={testLoading} disabled={!!pushUnavailableReason || !nativeTokens?.length} />
        </Card>
      </Section>

      <Section title="Preferences">
        {categories.map((category) => {
          const pref = preferences?.find((item: any) => item.category === category && item.scopeKey === "global");
          const enabled = pref?.enabled === true && ["PUSH", "TIME_SENSITIVE"].includes(pref.level);
          return (
            <ListRow
              key={category}
              title={category.replaceAll("_", " ")}
              subtitle={enabled ? "Push enabled" : "Off"}
              trailing={
                <Switch
                  value={enabled}
                  onValueChange={(next) =>
                    upsertPreference({
                      category: category as any,
                      enabled: next,
                      scopeKey: "global",
                      level: next ? "PUSH" : "OFF",
                    }).then(() => showToast({ title: "Preference updated", tone: "success" }))
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

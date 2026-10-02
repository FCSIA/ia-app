import { displayName } from '~/apps/shared/user-name';
import { useState } from "react";
import { Alert, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@/lib/convex-react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge, Button, Section, TextField, Txt, useToast } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const event = useQuery(api.events.events.get, id ? { eventId: id as any } : "skip");
  const cancelEvent = useMutation(api.events.events.cancel);
  const report = useMutation(api.moderation.reports.submit);
  const [reason, setReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const { showToast } = useToast();
  const { color } = useTheme();
  const canAdminCancel = !!user?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role));

  async function handleCancel(eventId: any) {
    setIsCancelling(true);
    try {
      await cancelEvent({ eventId });
      showToast({ title: "Event cancelled", tone: "success" });
    } catch (error) {
      showToast({
        title: "Couldn’t cancel event",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleReport(item: any) {
    setIsReporting(true);
    try {
      await report({
        contentType: "EVENT",
        contentId: item._id,
        reason: reason.trim(),
        reportedUserId: item.authorId,
      });
      setReason("");
      setShowReport(false);
      showToast({ title: "Report sent", body: "Staff have been notified.", tone: "success" });
    } catch (error) {
      showToast({
        title: "Report not sent",
        body: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setIsReporting(false);
    }
  }

  return (
    <Screen
      contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center" }}
      keyboardShouldPersistTaps="handled"
    >
      <DataBoundary data={event} emptyTitle="Event unavailable">
        {(item: any) => {
          const canCancel = item.status === "PUBLISHED" && (item.authorId === user?._id || canAdminCancel);
          const organizer = displayName(item.author);

          return (
            <View style={{ gap: spacing.xl }}>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
                  <Txt variant="overline" tone="primary">
                    {item.club?.name ?? "Innovation Academy"}
                  </Txt>
                  {item.status !== "PUBLISHED" ? (
                    <Badge
                      label={sentenceCase(item.status ?? "Event")}
                      color={item.status === "CANCELLED" ? "red" : "amber"}
                    />
                  ) : null}
                </View>
                <Txt variant="display">{item.title}</Txt>
                <Txt tone="muted">
                  {shortDate(item.startAt)} · {timeRange(item.startAt, item.endAt)}
                  {item.location ? ` · ${item.location}` : ""}
                </Txt>
              </View>

              {item.description ? <Txt>{item.description}</Txt> : null}

              <Section title="Details">
                <View>
                  <DetailRow label="Type" value={item.type ? sentenceCase(item.type) : null} />
                  <DetailRow label="Organizer" value={organizer} last />
                </View>
              </Section>

              <View
                style={{
                  gap: spacing.sm,
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: color("border"),
                }}
              >
                {canCancel ? (
                  <Button
                    title="Cancel event"
                    variant="tertiary"
                    loading={isCancelling}
                    onPress={() =>
                      Alert.alert("Cancel event?", "This event will no longer appear as published.", [
                        { text: "Keep event", style: "cancel" },
                        {
                          text: "Cancel event",
                          style: "destructive",
                          onPress: () => void handleCancel(item._id),
                        },
                      ])
                    }
                  />
                ) : null}

                {showReport ? (
                  <View style={{ gap: spacing.sm }}>
                    <Txt variant="label">Report this event</Txt>
                    <TextField
                      accessibilityLabel="Reason for reporting this event"
                      value={reason}
                      onChangeText={setReason}
                      placeholder="What should staff review?"
                      multiline
                      numberOfLines={4}
                      style={{ minHeight: 112 }}
                    />
                    <Button
                      title="Submit report"
                      disabled={!reason.trim()}
                      loading={isReporting}
                      onPress={() => void handleReport(item)}
                    />
                    <Button
                      title="Never mind"
                      variant="ghost"
                      disabled={isReporting}
                      onPress={() => {
                        setReason("");
                        setShowReport(false);
                      }}
                    />
                  </View>
                ) : (
                  <Button title="Report event" variant="ghost" onPress={() => setShowReport(true)} />
                )}
              </View>
            </View>
          );
        }}
      </DataBoundary>
    </Screen>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string | number | null;
  last?: boolean;
}) {
  const { color } = useTheme();
  if (!value) return null;

  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color("border"),
      }}
    >
      <Txt variant="label" tone="muted" style={{ width: 96 }}>
        {label}
      </Txt>
      <Txt style={{ flex: 1 }}>{String(value)}</Txt>
    </View>
  );
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

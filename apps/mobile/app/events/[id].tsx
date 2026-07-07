import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useCurrentUser } from "@/lib/auth";
import { shortDate, timeRange } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const event = useQuery(api.events.events.get, id ? { eventId: id as any } : "skip");
  const cancelEvent = useMutation(api.events.events.cancel);
  const report = useMutation(api.moderation.reports.submit);
  const [reason, setReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const { color } = useTheme();
  const canAdminCancel = !!user?.roles?.some((role) => ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"].includes(role));

  return (
    <Screen>
      <DataBoundary data={event} emptyTitle="Event unavailable">
        {(item: any) => (
          <View style={{ gap: 14 }}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge label={item.status?.replaceAll("_", " ") ?? "Event"} color={item.status === "PUBLISHED" ? "emerald" : "amber"} />
                <Badge label={item.club?.name ?? "General"} color={item.club ? "blue" : "gray"} />
              </View>
              <Text style={{ color: color("foreground"), fontSize: 28, fontWeight: "900" }}>{item.title}</Text>
              <Text style={{ color: color("mutedForeground"), lineHeight: 21 }}>
                {shortDate(item.startAt)} - {timeRange(item.startAt, item.endAt)}
                {item.location ? ` - ${item.location}` : ""}
              </Text>
              {item.description ? <Text style={{ color: color("mutedForeground"), lineHeight: 22 }}>{item.description}</Text> : null}
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Event Details</Text>
              <Detail label="Type" value={item.type} />
              <Detail label="Author" value={[item.author?.firstName, item.author?.lastName].filter(Boolean).join(" ")} />
              <Detail label="Published" value={item.publishedAt ? shortDate(item.publishedAt) : null} />
            </Card>

            {item.status === "PUBLISHED" && (item.authorId === user?._id || canAdminCancel) ? (
              <Button
                title="Cancel event"
                variant="tertiary"
                onPress={() =>
                  cancelEvent({ eventId: item._id }).catch((error) =>
                    Alert.alert("Could not cancel", error instanceof Error ? error.message : "Try again."),
                  )
                }
              />
            ) : null}

            <Card style={{ gap: 10 }}>
              <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Report</Text>
              {showReport ? (
                <>
                  <TextField value={reason} onChangeText={setReason} placeholder="What should staff review?" multiline />
                  <Button
                    title="Submit report"
                    disabled={!reason.trim()}
                    onPress={() =>
                      report({
                        contentType: "event",
                        contentId: item._id,
                        reason,
                        reportedUserId: item.authorId,
                      }).then(() => {
                        setReason("");
                        setShowReport(false);
                        Alert.alert("Reported", "Staff have been notified.");
                      }).catch((error) =>
                        Alert.alert("Report not sent", error instanceof Error ? error.message : "Try again."),
                      )
                    }
                  />
                </>
              ) : (
                <Button title="Report event" variant="secondary" onPress={() => setShowReport(true)} />
              )}
            </Card>
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const { color } = useTheme();
  if (!value) return null;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ color: color("mutedForeground"), width: 88, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: color("foreground"), flex: 1 }}>{String(value).replaceAll("_", " ")}</Text>
    </View>
  );
}

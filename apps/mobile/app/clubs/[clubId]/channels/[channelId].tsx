import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { AppBackHeader } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/lib/theme";
import { relativeTime } from "@/lib/format";
import { api } from "~/apps/convex/src/_generated/api";

export default function ChannelScreen() {
  const { clubId, channelId } = useLocalSearchParams<{ clubId: string; channelId: string }>();
  const messages = useQuery(
    api.clubs.channels.getMessages,
    clubId && channelId ? { clubId: clubId as any, channelId: channelId as any } : "skip"
  );
  const postMessage = useMutation(api.clubs.channels.postMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
  const report = useMutation(api.moderation.reports.submit);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [reportTarget, setReportTarget] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("");
  const { color } = useTheme();

  async function send() {
    if (!body.trim() || !channelId) return;
    try {
      await postMessage({
        channelId: channelId as any,
        body,
        parentMessageId: replyTo?._id,
        attachments: []
      });
      setBody("");
      setReplyTo(null);
    } catch (error) {
      Alert.alert("Message not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  async function submitReport() {
    if (!reportTarget || !reportReason.trim() || !clubId) return;
    try {
      await report({
        contentType: "clubChannelMessage",
        contentId: reportTarget._id,
        reason: reportReason,
        reportedUserId: reportTarget.authorId,
        clubId: clubId as any
      });
      setReportTarget(null);
      setReportReason("");
      Alert.alert("Reported", "Sponsors have been notified.");
    } catch (error) {
      Alert.alert("Report not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: color("background") }}
      >
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
        <AppBackHeader forceVisible />
      </View>
      <FlashList
        data={messages ?? []}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ color: color("mutedForeground") }}>No messages yet.</Text>}
        renderItem={({ item }: { item: any }) => (
          <Card style={{ marginBottom: 10, gap: 7 }}>
            <Text style={{ color: color("foreground"), fontWeight: "900" }}>
              {[item.author?.firstName, item.author?.lastName].filter(Boolean).join(" ") || "Member"}
            </Text>
            <Text style={{ color: color("foreground"), lineHeight: 21 }}>{item.body}</Text>
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{relativeTime(item.createdAt)}</Text>
            {item.replyCount ? (
              <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{item.replyCount} replies</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {["👍", "❤️", "✅"].map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`React ${emoji}`}
                  onPress={() => toggleReaction({ messageId: item._id, emoji })}
                  style={{
                    borderRadius: 999,
                    backgroundColor: color("secondary"),
                    paddingHorizontal: 10,
                    paddingVertical: 6
                  }}
                >
                  <Text>{emoji}</Text>
                </Pressable>
              ))}
              <Button title="Reply" size="sm" variant="ghost" onPress={() => setReplyTo(item)} />
              <Button
                title="Report"
                size="sm"
                variant="ghost"
                onPress={() => setReportTarget(item)}
              />
            </View>
          </Card>
        )}
      />
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: color("border"), gap: 8 }}>
        {reportTarget ? (
          <Card style={{ gap: 8 }}>
            <Text style={{ color: color("foreground"), fontWeight: "900" }}>Report message</Text>
            <Text style={{ color: color("mutedForeground") }}>Tell sponsors what needs review.</Text>
            <TextField placeholder="Reason" value={reportReason} onChangeText={setReportReason} multiline />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Submit" size="sm" onPress={submitReport} disabled={!reportReason.trim()} />
              <Button title="Cancel" size="sm" variant="ghost" onPress={() => setReportTarget(null)} />
            </View>
          </Card>
        ) : null}
        {replyTo ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: color("mutedForeground"), flex: 1 }} numberOfLines={1}>
              Replying to {replyTo.author?.firstName ?? "message"}
            </Text>
            <Button title="Cancel" size="sm" variant="ghost" onPress={() => setReplyTo(null)} />
          </View>
        ) : null}
        <TextField placeholder="Message this channel" value={body} onChangeText={setBody} multiline />
        <Button title="Send" onPress={send} disabled={!body.trim()} />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

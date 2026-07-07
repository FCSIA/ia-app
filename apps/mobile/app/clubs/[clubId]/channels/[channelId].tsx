import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
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
  const [body, setBody] = useState("");
  const { color } = useTheme();

  async function send() {
    if (!body.trim() || !channelId) return;
    try {
      await postMessage({ channelId: channelId as any, body, attachments: [] });
      setBody("");
    } catch (error) {
      Alert.alert("Message not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: color("background") }}
    >
      <FlashList
        data={messages ?? []}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ color: color("mutedForeground") }}>No messages yet.</Text>}
        renderItem={({ item }: { item: any }) => (
          <Card style={{ marginBottom: 10, gap: 5 }}>
            <Text style={{ color: color("foreground"), fontWeight: "900" }}>
              {[item.author?.firstName, item.author?.lastName].filter(Boolean).join(" ") || "Member"}
            </Text>
            <Text style={{ color: color("foreground"), lineHeight: 21 }}>{item.body}</Text>
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{relativeTime(item.createdAt)}</Text>
          </Card>
        )}
      />
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: color("border"), gap: 8 }}>
        <TextField placeholder="Message this channel" value={body} onChangeText={setBody} multiline />
        <Button title="Send" onPress={send} disabled={!body.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

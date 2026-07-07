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
import { useCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { relativeTime } from "@/lib/format";
import { api } from "~/apps/convex/src/_generated/api";

const reactions = ["LIKE", "HEART", "DONE"];

export default function ChannelScreen() {
  const { clubId, channelId } = useLocalSearchParams<{ clubId: string; channelId: string }>();
  const user = useCurrentUser();
  const messages = useQuery(
    api.clubs.channels.getMessages,
    clubId && channelId ? { clubId: clubId as any, channelId: channelId as any } : "skip",
  );
  const club = useQuery(api.clubs.detail.get, clubId ? { clubId: clubId as any } : "skip");
  const postMessage = useMutation(api.clubs.channels.postMessage);
  const updateMessage = useMutation(api.clubs.channels.updateMessage);
  const deleteMessage = useMutation(api.clubs.channels.deleteMessage);
  const toggleReaction = useMutation(api.clubs.channels.toggleReaction);
  const setPinned = useMutation(api.clubs.channels.setPinned);
  const votePoll = useMutation(api.clubs.channels.votePoll);
  const report = useMutation(api.moderation.reports.submit);
  const [body, setBody] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editBody, setEditBody] = useState("");
  const [reportTarget, setReportTarget] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("");
  const { color } = useTheme();

  async function send() {
    const options = pollOptions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!channelId || (!body.trim() && !pollQuestion.trim())) return;
    if (pollQuestion.trim() && options.length < 2) {
      Alert.alert("Poll", "Add at least two comma-separated options.");
      return;
    }
    try {
      await postMessage({
        channelId: channelId as any,
        body,
        parentMessageId: replyTo?._id,
        attachments: [],
        pollQuestion: pollQuestion.trim() || undefined,
        pollOptions: pollQuestion.trim() ? options.map((label, index) => ({ id: `option-${index + 1}`, label })) : undefined,
      });
      setBody("");
      setPollQuestion("");
      setPollOptions("");
      setReplyTo(null);
    } catch (error) {
      Alert.alert("Message not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  async function submitEdit() {
    if (!editTarget || !editBody.trim()) return;
    try {
      await updateMessage({ messageId: editTarget._id, body: editBody });
      setEditTarget(null);
      setEditBody("");
    } catch (error) {
      Alert.alert("Message not updated", error instanceof Error ? error.message : "Try again.");
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
        clubId: clubId as any,
      });
      setReportTarget(null);
      setReportReason("");
      Alert.alert("Reported", "Sponsors have been notified.");
    } catch (error) {
      Alert.alert("Report not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  function renderMessage(item: any) {
    const mine = item.authorId === user?._id;
    const canManage = !!club?.viewer?.canManageChannels;
    return (
      <Card style={{ marginBottom: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {item.isPinned ? <Text style={{ color: color("primary"), fontWeight: "900" }}>Pinned</Text> : null}
          <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{relativeTime(item.createdAt)}</Text>
        </View>
        <Text style={{ color: color("foreground"), fontWeight: "900" }}>
          {[item.author?.firstName, item.author?.lastName].filter(Boolean).join(" ") || "Member"}
        </Text>
        <Text style={{ color: color("foreground"), lineHeight: 21 }}>{item.body}</Text>

        {item.attachments?.map((attachment: any) => (
          <Text key={attachment._id} style={{ color: color("mutedForeground") }}>
            Attachment: {attachment.fileName}
          </Text>
        ))}

        {item.poll ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: color("foreground"), fontWeight: "900" }}>{item.poll.question}</Text>
            {item.poll.options.map((option: any) => (
              <Button
                key={option.id}
                title={`${option.label} (${option.count})${option.votedByCurrentUser ? " selected" : ""}`}
                size="sm"
                variant={option.votedByCurrentUser ? "primary" : "secondary"}
                onPress={() => votePoll({ messageId: item._id, optionId: option.id })}
              />
            ))}
            <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{item.poll.totalVotes} total votes</Text>
          </View>
        ) : null}

        {item.replies?.length ? (
          <View style={{ gap: 6, borderLeftWidth: 2, borderLeftColor: color("border"), paddingLeft: 10 }}>
            {item.replies.slice(0, 3).map((reply: any) => (
              <Text key={reply._id} style={{ color: color("mutedForeground") }}>
                {reply.author?.firstName ?? "Member"}: {reply.body}
              </Text>
            ))}
          </View>
        ) : item.replyCount ? (
          <Text style={{ color: color("mutedForeground"), fontSize: 12 }}>{item.replyCount} replies</Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {reactions.map((emoji) => {
            const existing = item.reactions?.find((reaction: any) => reaction.emoji === emoji);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => toggleReaction({ messageId: item._id, emoji })}
                style={{
                  borderRadius: 999,
                  backgroundColor: existing?.reactedByCurrentUser ? color("foreground") : color("secondary"),
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: existing?.reactedByCurrentUser ? color("background") : color("foreground"), fontWeight: "800" }}>
                  {emoji}{existing?.count ? ` ${existing.count}` : ""}
                </Text>
              </Pressable>
            );
          })}
          <Button title="Reply" size="sm" variant="ghost" onPress={() => setReplyTo(item)} />
          {(mine || canManage) ? (
            <Button title={item.isPinned ? "Unpin" : "Pin"} size="sm" variant="ghost" onPress={() => setPinned({ messageId: item._id, pinned: !item.isPinned })} />
          ) : null}
          {mine ? <Button title="Edit" size="sm" variant="ghost" onPress={() => { setEditTarget(item); setEditBody(item.body); }} /> : null}
          {(mine || canManage) ? (
            <Button
              title="Delete"
              size="sm"
              variant="ghost"
              onPress={() => deleteMessage({ messageId: item._id }).catch((error) => Alert.alert("Delete failed", error instanceof Error ? error.message : "Try again."))}
            />
          ) : null}
          <Button title="Report" size="sm" variant="ghost" onPress={() => setReportTarget(item)} />
        </View>
      </Card>
    );
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
          renderItem={({ item }: { item: any }) => renderMessage(item)}
        />
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: color("border"), gap: 8 }}>
          {editTarget ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ color: color("foreground"), fontWeight: "900" }}>Edit message</Text>
              <TextField placeholder="Message" value={editBody} onChangeText={setEditBody} multiline />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Save" size="sm" onPress={submitEdit} disabled={!editBody.trim()} />
                <Button title="Cancel" size="sm" variant="ghost" onPress={() => setEditTarget(null)} />
              </View>
            </Card>
          ) : null}
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
          <TextField placeholder="Poll question optional" value={pollQuestion} onChangeText={setPollQuestion} />
          {pollQuestion.trim() ? (
            <TextField placeholder="Poll options, comma separated" value={pollOptions} onChangeText={setPollOptions} />
          ) : null}
          <Button title="Send" onPress={send} disabled={!body.trim() && !pollQuestion.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  Check,
  CheckCircle2,
  Ellipsis,
  FileText,
  Flag,
  Heart,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Send,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { AppBackHeader } from "@/components/screen";
import { Avatar, Button, IconButton, PressableScale, TextField, Txt } from "@/components/ui";
import { useCurrentUser } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

const reactions: Array<{ payload: "LIKE" | "HEART" | "DONE"; label: string; icon: LucideIcon }> = [
  { payload: "LIKE", label: "Like", icon: ThumbsUp },
  { payload: "HEART", label: "Love", icon: Heart },
  { payload: "DONE", label: "Mark done", icon: CheckCircle2 },
];

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
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editBody, setEditBody] = useState("");
  const [reportTarget, setReportTarget] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const channel = club?.channels?.find((item: any) => item._id === channelId);
  const canPost = channel?.viewerCanPost ?? true;

  async function send() {
    const options = pollOptions
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!channelId || (!body.trim() && !pollQuestion.trim())) return;
    if (pollQuestion.trim() && options.length < 2) {
      Alert.alert("Poll needs more choices", "Add at least two comma-separated choices.");
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
      closePoll();
      setReplyTo(null);
    } catch (error) {
      Alert.alert("Message not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  function closePoll() {
    setShowPoll(false);
    setPollQuestion("");
    setPollOptions("");
  }

  function startReply(item: any) {
    setReplyTo(item);
    setEditTarget(null);
    setReportTarget(null);
    setExpandedActionsId(null);
  }

  function startEdit(item: any) {
    setEditTarget(item);
    setEditBody(item.body);
    setReplyTo(null);
    setReportTarget(null);
    setExpandedActionsId(null);
  }

  function startReport(item: any) {
    setReportTarget(item);
    setReportReason("");
    setReplyTo(null);
    setEditTarget(null);
    setExpandedActionsId(null);
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
      Alert.alert("Report sent", "Club sponsors have been notified.");
    } catch (error) {
      Alert.alert("Report not sent", error instanceof Error ? error.message : "Try again.");
    }
  }

  function confirmDelete(item: any) {
    Alert.alert("Delete message?", "This cannot be undone.", [
      { text: "Keep message", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteMessage({ messageId: item._id }).catch((error) =>
            Alert.alert("Message not deleted", error instanceof Error ? error.message : "Try again."),
          ),
      },
    ]);
  }

  function renderMessage(item: any) {
    const mine = item.authorId === user?._id;
    const canManage = !!club?.viewer?.canManageChannels;
    const authorName = [item.author?.firstName, item.author?.lastName].filter(Boolean).join(" ") || "Member";
    const actionsExpanded = expandedActionsId === item._id;

    return (
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingVertical: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: color("border"),
          flexDirection: "row",
          alignItems: "flex-start",
          gap: spacing.md,
        }}
      >
        <Avatar uri={item.author?.avatarUrl} name={authorName} size={38} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Txt style={{ flex: 1, fontWeight: "700" }} numberOfLines={1}>
              {authorName}
            </Txt>
            {item.isPinned ? <Pin size={14} color={color("primary")} fill={color("primary")} /> : null}
            <Txt variant="caption" tone="muted" numberOfLines={1}>
              {relativeTime(item.createdAt)}
            </Txt>
          </View>

          {item.body ? <Txt style={{ lineHeight: 22 }}>{item.body}</Txt> : null}

          {item.attachments?.map((attachment: any) => (
            <View
              key={attachment._id}
              style={{
                minHeight: 44,
                borderRadius: radii.md,
                backgroundColor: color("muted"),
                paddingHorizontal: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <FileText size={18} color={color("mutedForeground")} />
              <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                {attachment.fileName}
              </Txt>
            </View>
          ))}

          {item.poll ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <Txt style={{ fontWeight: "700" }}>{item.poll.question}</Txt>
              {item.poll.options.map((option: any) => (
                <PressableScale
                  key={option.id}
                  accessibilityLabel={`${option.label}, ${option.count} ${option.count === 1 ? "vote" : "votes"}${option.votedByCurrentUser ? ", selected" : ""}`}
                  onPress={() => votePoll({ messageId: item._id, optionId: option.id })}
                  style={{
                    minHeight: 44,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: option.votedByCurrentUser ? color("primary") : color("border"),
                    backgroundColor: option.votedByCurrentUser ? color("secondary") : color("card"),
                    paddingHorizontal: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                  }}
                >
                  <Txt variant="label" style={{ flex: 1 }} numberOfLines={2}>
                    {option.label}
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    {option.count}
                  </Txt>
                  {option.votedByCurrentUser ? <Check size={16} color={color("primary")} strokeWidth={2.4} /> : null}
                </PressableScale>
              ))}
              <Txt variant="caption" tone="muted">
                {item.poll.totalVotes} {item.poll.totalVotes === 1 ? "vote" : "votes"}
              </Txt>
            </View>
          ) : null}

          {item.replies?.length ? (
            <View style={{ gap: spacing.sm, borderLeftWidth: 2, borderLeftColor: color("border"), paddingLeft: spacing.md }}>
              {item.replies.slice(0, 3).map((reply: any) => {
                const replyAuthor = [reply.author?.firstName, reply.author?.lastName].filter(Boolean).join(" ") || "Member";
                return (
                  <View key={reply._id} style={{ gap: 2 }}>
                    <Txt variant="caption" style={{ fontWeight: "700" }} numberOfLines={1}>
                      {replyAuthor}
                    </Txt>
                    <Txt variant="label" tone="muted" numberOfLines={3}>
                      {reply.body}
                    </Txt>
                  </View>
                );
              })}
              {item.replyCount > 3 ? (
                <Txt variant="caption" tone="primary">
                  +{item.replyCount - 3} more
                </Txt>
              ) : null}
            </View>
          ) : item.replyCount ? (
            <Txt variant="caption" tone="muted">
              {item.replyCount} {item.replyCount === 1 ? "reply" : "replies"}
            </Txt>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.xs }}>
            {reactions.map(({ payload, label, icon: ReactionIcon }) => {
              const existing = item.reactions?.find((reaction: any) => reaction.emoji === payload);
              const selected = !!existing?.reactedByCurrentUser;
              return (
                <PressableScale
                  key={payload}
                  accessibilityLabel={`${label} message${existing?.count ? `, ${existing.count}` : ""}`}
                  accessibilityState={{ selected }}
                  onPress={() => toggleReaction({ messageId: item._id, emoji: payload })}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: radii.pill,
                    backgroundColor: selected ? color("secondary") : "transparent",
                    paddingHorizontal: spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                  }}
                >
                  <ReactionIcon
                    size={17}
                    color={selected ? color("primary") : color("mutedForeground")}
                    fill={payload === "HEART" && selected ? color("primary") : "transparent"}
                    strokeWidth={selected ? 2.2 : 1.8}
                  />
                  {existing?.count ? (
                    <Txt variant="caption" tone={selected ? "primary" : "muted"} style={{ fontWeight: "700" }}>
                      {existing.count}
                    </Txt>
                  ) : null}
                </PressableScale>
              );
            })}
            <IconButton icon={MessageCircle} label={`Reply to ${authorName}`} size="sm" variant="ghost" onPress={() => startReply(item)} />
            <IconButton
              icon={actionsExpanded ? X : Ellipsis}
              label={actionsExpanded ? "Close message actions" : "More message actions"}
              size="sm"
              variant="ghost"
              onPress={() => setExpandedActionsId(actionsExpanded ? null : item._id)}
            />
          </View>

          {actionsExpanded ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {(mine || canManage) ? (
                <MessageAction
                  icon={item.isPinned ? PinOff : Pin}
                  label={item.isPinned ? "Unpin" : "Pin"}
                  onPress={() => {
                    setPinned({ messageId: item._id, pinned: !item.isPinned }).catch((error) =>
                      Alert.alert("Pin not updated", error instanceof Error ? error.message : "Try again."),
                    );
                    setExpandedActionsId(null);
                  }}
                />
              ) : null}
              {mine ? <MessageAction icon={Pencil} label="Edit" onPress={() => startEdit(item)} /> : null}
              <MessageAction icon={Flag} label="Report" onPress={() => startReport(item)} />
              {(mine || canManage) ? (
                <MessageAction icon={Trash2} label="Delete" destructive onPress={() => confirmDelete(item)} />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: color("background") }}
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm }}>
          <AppBackHeader forceVisible />
          <View style={{ gap: 2 }}>
            <Txt variant="title" numberOfLines={1}>
              #{channel?.name ?? "channel"}
            </Txt>
            <Txt variant="caption" tone="muted" numberOfLines={2}>
              {channel?.description ?? club?.name ?? "Club channel"}
            </Txt>
          </View>
        </View>

        <FlashList
          data={messages ?? []}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 48 }}>
              <Txt variant="section">Start the conversation</Txt>
            </View>
          }
          renderItem={({ item }: { item: any }) => renderMessage(item)}
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: color("border"),
            backgroundColor: color("card"),
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(spacing.md, insets.bottom),
            gap: spacing.sm,
          }}
        >
          {!canPost ? (
            <Txt variant="label" tone="muted" style={{ minHeight: 44, textAlignVertical: "center" }}>
              This channel is read-only.
            </Txt>
          ) : editTarget ? (
            <>
              <ComposerModeHeader label="Edit message" onClose={() => setEditTarget(null)} />
              <TextField
                placeholder="Message"
                accessibilityLabel="Edit message"
                value={editBody}
                onChangeText={setEditBody}
                multiline
                style={{ maxHeight: 132 }}
              />
              <Button title="Save changes" size="sm" onPress={submitEdit} disabled={!editBody.trim()} />
            </>
          ) : reportTarget ? (
            <>
              <ComposerModeHeader label="Report message" onClose={() => setReportTarget(null)} />
              <Txt variant="caption" tone="muted">
                Tell club sponsors what needs review.
              </Txt>
              <TextField
                placeholder="What happened?"
                accessibilityLabel="Reason for report"
                value={reportReason}
                onChangeText={setReportReason}
                multiline
                style={{ maxHeight: 132 }}
              />
              <Button title="Send report" size="sm" onPress={submitReport} disabled={!reportReason.trim()} />
            </>
          ) : (
            <>
              {replyTo ? (
                <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <MessageCircle size={17} color={color("mutedForeground")} />
                  <Txt variant="label" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                    Replying to {replyTo.author?.firstName ?? "message"}
                  </Txt>
                  <IconButton icon={X} label="Cancel reply" size="sm" variant="ghost" onPress={() => setReplyTo(null)} />
                </View>
              ) : null}

              {showPoll ? (
                <View style={{ gap: spacing.sm }}>
                  <ComposerModeHeader label="Add poll" onClose={closePoll} />
                  <TextField
                    placeholder="Question"
                    accessibilityLabel="Poll question"
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                  />
                  <TextField
                    placeholder="Choices separated by commas"
                    accessibilityLabel="Poll choices"
                    value={pollOptions}
                    onChangeText={setPollOptions}
                  />
                  <Txt variant="caption" tone="muted">
                    Add 2–6 choices.
                  </Txt>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
                <TextField
                  placeholder={replyTo ? "Write a reply" : "Message channel"}
                  accessibilityLabel={replyTo ? "Reply" : "Message channel"}
                  value={body}
                  onChangeText={setBody}
                  multiline
                  style={{ flex: 1, maxHeight: 132 }}
                />
                {!showPoll ? (
                  <IconButton icon={BarChart3} label="Add poll" size="sm" variant="ghost" onPress={() => setShowPoll(true)} />
                ) : null}
                <IconButton
                  icon={Send}
                  label="Send message"
                  size="sm"
                  variant="primary"
                  disabled={!body.trim() && !pollQuestion.trim()}
                  onPress={send}
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageAction({
  icon: Icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { color } = useTheme();
  const actionColor = destructive ? color("destructive") : color("mutedForeground");
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Icon size={17} color={actionColor} strokeWidth={1.9} />
      <Txt variant="label" tone={destructive ? "destructive" : "muted"}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function ComposerModeHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Txt variant="label" style={{ flex: 1, fontWeight: "700" }}>
        {label}
      </Txt>
      <IconButton icon={X} label={`Close ${label.toLowerCase()}`} size="sm" variant="ghost" onPress={onClose} />
    </View>
  );
}

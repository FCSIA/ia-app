import { View, type LayoutChangeEvent } from "react-native";
import {
  BarChart3,
  MessageCircle,
  Pencil,
  Send,
  ShieldAlert,
  X,
} from "lucide-react-native";
import { Button, IconButton, TextField, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import type { ChatComposerController } from "./use-chat-composer";
import { chatAuthorName } from "./types";

type ChatComposerProps = {
  composer: ChatComposerController;
  canPost?: boolean;
  isPending: boolean;
  bottomInset: number;
  channelName?: string;
  threadMode?: boolean;
  inputNativeID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  onSubmit: () => void;
};

export function ChatComposer({
  composer,
  canPost,
  isPending,
  bottomInset,
  channelName,
  threadMode = false,
  inputNativeID,
  onLayout,
  onSubmit,
}: ChatComposerProps) {
  const { color } = useTheme();
  const requiresPostingPermission =
    composer.mode.kind === "message" ||
    composer.mode.kind === "reply" ||
    composer.mode.kind === "poll";
  const unavailable = requiresPostingPermission && canPost !== true;

  return (
    <View
      onLayout={onLayout}
      style={{
        width: "100%",
        borderTopWidth: 1,
        borderTopColor: color("border"),
        backgroundColor: color("card"),
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(spacing.sm, bottomInset),
          gap: spacing.sm,
        }}
      >
        {unavailable ? (
          <View style={{ minHeight: 44, justifyContent: "center" }}>
            <Txt variant="label" tone="muted">
              {canPost === undefined
                ? "Loading channel…"
                : "This channel is read-only."}
            </Txt>
          </View>
        ) : composer.mode.kind === "edit" ? (
          <>
            <ComposerModeHeader
              icon={Pencil}
              label="Edit message"
              onClose={composer.reset}
            />
            <PlainChatInput
              accessibilityLabel="Edit message"
              placeholder="Message"
              value={composer.draft}
              onChangeText={composer.setDraft}
              editable={!isPending}
              nativeID={inputNativeID}
            />
            <Button
              title="Save changes"
              size="sm"
              loading={isPending}
              disabled={!composer.draft.trim()}
              onPress={onSubmit}
            />
          </>
        ) : composer.mode.kind === "report" ? (
          <>
            <ComposerModeHeader
              icon={ShieldAlert}
              label="Report message"
              onClose={composer.reset}
            />
            <Txt variant="caption" tone="muted">
              Tell school moderators what needs review. The message author will
              not see your report.
            </Txt>
            <PlainChatInput
              accessibilityLabel="Reason for report"
              placeholder="What happened?"
              value={composer.draft}
              onChangeText={composer.setDraft}
              editable={!isPending}
              nativeID={inputNativeID}
            />
            <Button
              title="Send report"
              size="sm"
              loading={isPending}
              disabled={!composer.draft.trim()}
              onPress={onSubmit}
            />
          </>
        ) : composer.mode.kind === "poll" ? (
          <>
            <ComposerModeHeader
              icon={BarChart3}
              label="Create a poll"
              onClose={composer.reset}
            />
            <TextField
              accessibilityLabel="Poll question"
              placeholder="Question"
              value={composer.pollQuestion}
              onChangeText={composer.setPollQuestion}
              editable={!isPending}
              returnKeyType="next"
            />
            <TextField
              accessibilityLabel="Poll choices"
              placeholder="Choices separated by commas"
              value={composer.pollOptions}
              onChangeText={composer.setPollOptions}
              editable={!isPending}
            />
            <PlainChatInput
              accessibilityLabel="Optional poll message"
              placeholder="Add a note (optional)"
              value={composer.draft}
              onChangeText={composer.setDraft}
              editable={!isPending}
              nativeID={inputNativeID}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
                Add 2–6 choices.
              </Txt>
              <Button
                title="Post poll"
                size="sm"
                icon={Send}
                loading={isPending}
                disabled={
                  !composer.pollQuestion.trim() || !composer.pollOptions.trim()
                }
                onPress={onSubmit}
              />
            </View>
          </>
        ) : (
          <>
            {composer.mode.kind === "reply" ? (
              <ComposerModeHeader
                icon={MessageCircle}
                label={`Replying to ${chatAuthorName(composer.mode.target)}`}
                detail={composer.mode.target.body}
                onClose={composer.reset}
              />
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: spacing.sm,
              }}
            >
              <PlainChatInput
                accessibilityLabel={
                  threadMode || composer.mode.kind === "reply"
                    ? "Reply"
                    : "Message channel"
                }
                placeholder={
                  threadMode
                    ? "Reply in thread"
                    : composer.mode.kind === "reply"
                      ? "Write a reply"
                      : `Message #${channelName ?? "channel"}`
                }
                value={composer.draft}
                onChangeText={composer.setDraft}
                editable={!isPending}
                nativeID={inputNativeID}
                style={{ flex: 1 }}
              />
              <IconButton
                icon={BarChart3}
                label="Create poll"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onPress={composer.startPoll}
              />
              <IconButton
                icon={Send}
                label={
                  threadMode || composer.mode.kind === "reply"
                    ? "Send reply"
                    : "Send message"
                }
                size="sm"
                variant="primary"
                disabled={isPending || !composer.draft.trim()}
                onPress={onSubmit}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function PlainChatInput({
  style,
  ...props
}: React.ComponentProps<typeof TextField>) {
  return <TextField multiline style={[{ maxHeight: 120 }, style]} {...props} />;
}

function ComposerModeHeader({
  icon: Icon,
  label,
  detail,
  onClose,
}: {
  icon: typeof Pencil;
  label: string;
  detail?: string;
  onClose: () => void;
}) {
  const { color } = useTheme();
  return (
    <View
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <Icon size={17} color={color("primary")} strokeWidth={2} />
      <View style={{ minWidth: 0, flex: 1 }}>
        <Txt variant="label" numberOfLines={1} style={{ fontWeight: "800" }}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
      <IconButton
        icon={X}
        label={`Close ${label.toLowerCase()}`}
        size="sm"
        variant="ghost"
        onPress={onClose}
      />
    </View>
  );
}

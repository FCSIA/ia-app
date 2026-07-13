import { ScrollView, View } from "react-native";
import {
  Flag,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { PressableScale, Sheet, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import {
  normalizeReactionSummaries,
  QUICK_REACTIONS,
} from "./quick-reactions";
import {
  chatAuthorName,
  type ChatMessage,
  type QuickReaction,
} from "./types";

type MessageActionsSheetProps = {
  message: ChatMessage | null;
  currentUserId?: string;
  canPost?: boolean;
  canManage: boolean;
  pendingActions: ReadonlySet<string>;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onReport: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onTogglePin: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, reaction: QuickReaction) => void;
};

export function MessageActionsSheet({
  message,
  currentUserId,
  canPost,
  canManage,
  pendingActions,
  onClose,
  onReply,
  onEdit,
  onReport,
  onDelete,
  onTogglePin,
  onToggleReaction,
}: MessageActionsSheetProps) {
  const { color } = useTheme();
  const mine = !!message && message.authorId === currentUserId;
  const canModerateMessage = mine || canManage;
  const disabled =
    !!message &&
    [...pendingActions].some((key) => key.includes(message._id));
  const reactions = normalizeReactionSummaries(message?.reactions ?? []);

  return (
    <Sheet
      open={!!message}
      onClose={onClose}
      title={
        message ? `Message from ${chatAuthorName(message)}` : "Message actions"
      }
      scrollable
    >
      {message ? (
        <>
          <ScrollView
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {QUICK_REACTIONS.map(({ payload, label, glyph }) => {
              const reaction = reactions.find(
                (entry) => entry.emoji === payload,
              );
              const selected = !!reaction?.reactedByCurrentUser;
              const reactionPending =
                pendingActions.has(`reaction:${message._id}:${payload}`);
              return (
                <PressableScale
                  key={payload}
                  accessibilityLabel={`${label}${reaction?.count ? `, ${reaction.count}` : ""}`}
                  accessibilityState={{
                    selected,
                    disabled: disabled || reactionPending,
                  }}
                  disabled={disabled || reactionPending}
                  onPress={() => onToggleReaction(message, payload)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.pill,
                    backgroundColor: selected
                      ? color("secondary")
                      : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt style={{ fontSize: 23, lineHeight: 28 }}>{glyph}</Txt>
                  {reaction?.count ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: -2,
                        minWidth: 18,
                        height: 18,
                        borderRadius: radii.pill,
                        backgroundColor: color("card"),
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 3,
                      }}
                    >
                      <Txt
                        variant="caption"
                        tone={selected ? "primary" : "muted"}
                        style={{ fontSize: 10, lineHeight: 12, fontWeight: "800" }}
                      >
                        {reaction.count}
                      </Txt>
                    </View>
                  ) : null}
                </PressableScale>
              );
            })}
          </ScrollView>

          <View style={{ gap: 2 }}>
            {canPost === true ? (
              <ActionRow
                icon={MessageCircle}
                label="Reply"
                disabled={disabled}
                onPress={() => onReply(message)}
              />
            ) : null}
            {canModerateMessage ? (
              <ActionRow
                icon={message.isPinned ? PinOff : Pin}
                label={message.isPinned ? "Unpin message" : "Pin message"}
                disabled={disabled}
                onPress={() => onTogglePin(message)}
              />
            ) : null}
            {mine ? (
              <ActionRow
                icon={Pencil}
                label="Edit message"
                disabled={disabled}
                onPress={() => onEdit(message)}
              />
            ) : null}
            <ActionRow
              icon={Flag}
              label="Report message"
              disabled={disabled}
              onPress={() => onReport(message)}
            />
            {canModerateMessage ? (
              <ActionRow
                icon={Trash2}
                label="Delete message"
                destructive
                disabled={disabled}
                onPress={() => onDelete(message)}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  disabled,
  destructive = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const foreground = destructive ? color("destructive") : color("foreground");
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      haptic={false}
      onPress={onPress}
      style={{
        minHeight: 46,
        borderRadius: radii.md,
        paddingHorizontal: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon size={19} color={foreground} strokeWidth={1.9} />
      <Txt variant="label" style={{ color: foreground, fontWeight: "700" }}>
        {label}
      </Txt>
    </PressableScale>
  );
}

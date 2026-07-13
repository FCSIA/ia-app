import { View } from "react-native";
import { Flag, MessageCircle, Pencil, Pin, PinOff, Trash2, type LucideIcon } from "lucide-react-native";
import { PressableScale, Sheet, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { QUICK_REACTIONS } from "./quick-reactions";
import { chatAuthorName, type ChatMessage } from "./types";

type MessageActionsSheetProps = {
  message: ChatMessage | null;
  currentUserId?: string;
  canManage: boolean;
  pendingAction?: string | null;
  onClose: () => void;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onReport: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onTogglePin: (message: ChatMessage) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
};

export function MessageActionsSheet({
  message,
  currentUserId,
  canManage,
  pendingAction,
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
  const disabled = !!pendingAction;

  return (
    <Sheet
      open={!!message}
      onClose={onClose}
      title={message ? `Message from ${chatAuthorName(message)}` : "Message actions"}
      snapPoints={["58%"]}
    >
      {message ? (
        <>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {QUICK_REACTIONS.map(({ payload, label, icon: ReactionIcon }) => {
              const reaction = message.reactions?.find((entry) => entry.emoji === payload);
              const selected = !!reaction?.reactedByCurrentUser;
              const reactionPending = pendingAction === `reaction:${message._id}:${payload}`;
              return (
                <PressableScale
                  key={payload}
                  accessibilityLabel={`${label}${reaction?.count ? `, ${reaction.count}` : ""}`}
                  accessibilityState={{ selected, disabled: disabled || reactionPending }}
                  disabled={disabled || reactionPending}
                  onPress={() => onToggleReaction(message, payload)}
                  style={{
                    minHeight: 52,
                    flex: 1,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: selected ? color("primary") : color("border"),
                    backgroundColor: selected ? color("secondary") : color("muted"),
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                  }}
                >
                  <ReactionIcon
                    size={19}
                    color={selected ? color("primary") : color("mutedForeground")}
                    fill={payload === "HEART" && selected ? color("primary") : "transparent"}
                    strokeWidth={selected ? 2.3 : 1.9}
                  />
                  {reaction?.count ? (
                    <Txt variant="caption" tone={selected ? "primary" : "muted"} style={{ fontWeight: "800" }}>
                      {reaction.count}
                    </Txt>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>

          <View style={{ gap: 2 }}>
            <ActionRow icon={MessageCircle} label="Reply" disabled={disabled} onPress={() => onReply(message)} />
            {canModerateMessage ? (
              <ActionRow
                icon={message.isPinned ? PinOff : Pin}
                label={message.isPinned ? "Unpin message" : "Pin message"}
                disabled={disabled}
                onPress={() => onTogglePin(message)}
              />
            ) : null}
            {mine ? <ActionRow icon={Pencil} label="Edit message" disabled={disabled} onPress={() => onEdit(message)} /> : null}
            <ActionRow icon={Flag} label="Report message" disabled={disabled} onPress={() => onReport(message)} />
            {canModerateMessage ? (
              <ActionRow icon={Trash2} label="Delete message" destructive disabled={disabled} onPress={() => onDelete(message)} />
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

import { View } from "react-native";
import { format } from "date-fns";
import {
  Flag,
  MessageCircle,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { Avatar, PressableScale, Sheet, Txt } from "@/components/ui";
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
      title="Message actions"
      scrollable
    >
      {message ? (
        <>
          <View
            style={{
              minHeight: 52,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: spacing.sm,
            }}
          >
            <Avatar
              uri={message.author?.avatarUrl}
              name={chatAuthorName(message)}
              size={36}
            />
            <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: spacing.xs,
                }}
              >
                <Txt variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {chatAuthorName(message)}
                </Txt>
                <Txt variant="caption" tone="muted">
                  {format(new Date(message.createdAt), "h:mm a")}
                </Txt>
              </View>
              <Txt variant="body" numberOfLines={3}>
                {message.body ||
                  (message.attachments?.length
                    ? `${message.attachments.length} ${message.attachments.length === 1 ? "attachment" : "attachments"}`
                    : "Message")}
              </Txt>
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            <Txt variant="caption" tone="muted" style={{ fontWeight: "800" }}>
              React
            </Txt>
            <View
              accessibilityLabel="Choose a reaction"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
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
                    accessibilityLabel={`${selected ? "Remove" : "Add"} ${label.toLowerCase()} reaction${reaction?.count ? `, ${reaction.count}` : ""}`}
                    accessibilityState={{
                      selected,
                      disabled: disabled || reactionPending,
                    }}
                    disabled={disabled || reactionPending}
                    onPress={() => {
                      onClose();
                      onToggleReaction(message, payload);
                    }}
                    style={{
                      width: "31.5%",
                      minHeight: 56,
                      borderRadius: radii.md,
                      backgroundColor: selected
                        ? color("secondary")
                        : "transparent",
                      paddingHorizontal: spacing.xs,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                    }}
                  >
                    <Txt style={{ fontSize: 22, lineHeight: 25 }}>{glyph}</Txt>
                    <Txt
                      variant="caption"
                      tone={selected ? "primary" : "muted"}
                      numberOfLines={1}
                      style={{ fontSize: 11, fontWeight: "700" }}
                    >
                      {label}
                      {reaction?.count ? ` · ${reaction.count}` : ""}
                    </Txt>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 2 }}>
            {canPost === true ? (
              <ActionRow
                icon={MessageCircle}
                label="Reply"
                disabled={disabled}
                onPress={() => onReply(message)}
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
            {canModerateMessage ? (
              <ActionRow
                icon={message.isPinned ? PinOff : Pin}
                label={message.isPinned ? "Unpin message" : "Pin message"}
                disabled={disabled}
                onPress={() => onTogglePin(message)}
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

import { View } from "react-native";
import {
  Check,
  Hash,
  LockKeyhole,
  Megaphone,
  type LucideIcon,
} from "lucide-react-native";
import { PressableScale, Sheet, Skeleton, Txt } from "@/components/ui";
import { useQuery } from "@/lib/convex-react";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

type ChannelVisibility = "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";

type SwitcherChannel = {
  _id: string;
  name: string;
  visibility: ChannelVisibility;
};

type ChannelSwitcherSheetProps = {
  open: boolean;
  clubId: string;
  currentChannelId: string;
  onClose: () => void;
  onSelect: (channelId: string) => void;
};

export function ChannelSwitcherSheet({
  open,
  clubId,
  currentChannelId,
  onClose,
  onSelect,
}: ChannelSwitcherSheetProps) {
  // Same source and order as the club screen's channel list. The club screen
  // usually sits beneath this route, so the subscription is already warm.
  const club = useQuery(
    api.clubs.detail.get,
    open ? { clubId: clubId as Id<"clubs"> } : "skip",
  );
  const channels =
    club === undefined
      ? undefined
      : ((club?.channels ?? []) as SwitcherChannel[]);

  return (
    <Sheet open={open} onClose={onClose} title="Channels" scrollable>
      {channels === undefined ? (
        <View style={{ gap: spacing.xs }}>
          {[0, 1, 2].map((key) => (
            <Skeleton
              key={key}
              style={{ height: 44, width: "100%", borderRadius: radii.sm }}
            />
          ))}
        </View>
      ) : channels.length ? (
        <View accessibilityRole="menu">
          {channels.map((channel) => (
            <ChannelRow
              key={channel._id}
              channel={channel}
              current={channel._id === currentChannelId}
              onPress={() =>
                channel._id === currentChannelId
                  ? onClose()
                  : onSelect(channel._id)
              }
            />
          ))}
        </View>
      ) : (
        <Txt variant="caption" tone="muted">
          No channels yet.
        </Txt>
      )}
    </Sheet>
  );
}

function ChannelRow({
  channel,
  current,
  onPress,
}: {
  channel: SwitcherChannel;
  current: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  const Icon = channelVisibilityIcon(channel.visibility);
  return (
    <PressableScale
      accessibilityRole="menuitem"
      accessibilityLabel={
        current
          ? `${channel.name} channel, current`
          : `Switch to ${channel.name} channel`
      }
      accessibilityState={{ selected: current }}
      haptic={false}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: current ? color("secondary") : "transparent",
      }}
    >
      <Icon
        size={20}
        color={current ? color("primary") : color("mutedForeground")}
        strokeWidth={2}
      />
      <Txt
        tone={current ? "default" : "muted"}
        numberOfLines={1}
        style={{ flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "600" }}
      >
        {channel.name}
      </Txt>
      {current ? (
        <Check size={18} color={color("primary")} strokeWidth={2.2} />
      ) : null}
    </PressableScale>
  );
}

function channelVisibilityIcon(visibility: ChannelVisibility): LucideIcon {
  if (visibility === "PRIVATE") return LockKeyhole;
  if (visibility === "MEMBER_READONLY") return Megaphone;
  return Hash;
}

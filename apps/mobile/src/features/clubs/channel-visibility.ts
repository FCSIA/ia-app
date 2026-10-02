import { Hash, LockKeyhole, Megaphone, type LucideIcon } from "lucide-react-native";

export type ChannelVisibility = "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";

/** The icon every channel list uses for a channel's visibility. */
export function channelVisibilityIcon(visibility: ChannelVisibility): LucideIcon {
  if (visibility === "PRIVATE") return LockKeyhole;
  if (visibility === "MEMBER_READONLY") return Megaphone;
  return Hash;
}

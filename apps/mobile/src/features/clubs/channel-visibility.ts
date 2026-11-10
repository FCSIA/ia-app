import { Hash, LockKeyhole, Megaphone, type LucideIcon } from "lucide-react-native";

import type { ChannelVisibility } from "~/apps/shared/chat/protocol";

/** The icon every channel list uses for a channel's visibility. */
export function channelVisibilityIcon(visibility: ChannelVisibility): LucideIcon {
  if (visibility === "PRIVATE") return LockKeyhole;
  if (visibility === "MEMBER_READONLY") return Megaphone;
  return Hash;
}

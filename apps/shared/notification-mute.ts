/** Channel mute state shared by the backend and the web client. */
export type ChannelMute = {
  isMuted?: boolean | null;
  // null means muted until the person unmutes.
  mutedUntil?: number | null;
};

export function isMuteActive(mute: ChannelMute | null | undefined, now: number): boolean {
  return !!mute?.isMuted && (mute.mutedUntil == null || mute.mutedUntil > now);
}

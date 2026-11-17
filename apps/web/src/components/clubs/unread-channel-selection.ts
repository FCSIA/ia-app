export function selectUnreadChannels<T extends { _id: string }>(
  channels: readonly T[],
  activity: readonly { channelId: string; hasUnreadMessages: boolean }[],
): T[] {
  const unread = new Set(activity.filter((row) => row.hasUnreadMessages).map((row) => row.channelId));
  return channels.filter((channel) => unread.has(channel._id));
}


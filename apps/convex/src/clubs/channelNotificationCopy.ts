export type ChannelNotificationKind =
  | "MESSAGE"
  | "THREAD_REPLY"
  | "REPLY"
  | "USER_MENTION"
  | "GROUP_MENTION";

export function channelNotificationTitle(input: {
  authorName: string;
  channelName: string;
  kind: ChannelNotificationKind;
}) {
  const authorName = input.authorName.trim() || "Club member";
  const channelName = `#${input.channelName}`;

  switch (input.kind) {
    case "THREAD_REPLY":
      return `${authorName} replied in ${channelName}`;
    case "REPLY":
      return `${authorName} replied to you in ${channelName}`;
    case "USER_MENTION":
      return `${authorName} mentioned you in ${channelName}`;
    case "GROUP_MENTION":
      return `${authorName} mentioned your group in ${channelName}`;
    case "MESSAGE":
      return `${authorName} in ${channelName}`;
  }
}

export function channelNotificationAuthorName(author: {
  firstName?: string;
  lastName?: string;
}) {
  return [author.firstName, author.lastName].filter(Boolean).join(" ").trim();
}

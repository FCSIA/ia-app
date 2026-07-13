export type ChatUser = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

export type ChatAttachment = {
  _id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
  countIsCapped?: boolean;
};

export type ChatPollOption = {
  id: string;
  label: string;
  count: number;
  votedByCurrentUser: boolean;
};

export type ChatPoll = {
  question: string;
  options: ChatPollOption[];
  totalVotes: number;
  votesTruncated?: boolean;
};

export type ChatMessage = {
  _id: string;
  authorId: string;
  parentMessageId?: string;
  body: string;
  bodyMarkdown?: string;
  bodyRich?: unknown;
  author?: ChatUser | null;
  attachments?: ChatAttachment[];
  attachmentsTruncated?: boolean;
  reactions?: ChatReaction[];
  replies?: ChatMessage[];
  replyCount: number;
  replyCountIsExact?: boolean;
  hasReplies?: boolean;
  latestReplyPreview?: {
    _id: string;
    body: string;
    createdAt: string;
  } | null;
  poll?: ChatPoll | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatThread = {
  root: ChatMessage;
  replies: ChatMessage[];
  hasMoreReplies: boolean;
};

export type ChatChannel = {
  _id: string;
  name: string;
  description?: string | null;
  visibility?: string;
  viewerCanPost?: boolean;
};

export type ClubChatData = {
  name?: string;
  channels?: ChatChannel[];
  viewer?: {
    canManageChannels?: boolean;
  };
};

export type QuickReaction = "LIKE" | "HEART" | "DONE";

export type ComposerMode =
  | { kind: "message" }
  | { kind: "reply"; target: ChatMessage }
  | { kind: "edit"; target: ChatMessage }
  | { kind: "report"; target: ChatMessage }
  | { kind: "poll" };

export function chatAuthorName(message: ChatMessage) {
  return [message.author?.firstName, message.author?.lastName].filter(Boolean).join(" ") || "Member";
}

export function isImageAttachment(attachment: ChatAttachment) {
  if (attachment.mimeType) {
    return attachment.mimeType.startsWith("image/") && attachment.mimeType !== "image/svg+xml";
  }
  const source = `${attachment.fileName} ${attachment.fileUrl}`.toLowerCase();
  return /\.(avif|heic|heif|jpe?g|png|webp)(?:\?|#|\s|$)/.test(source);
}

export function formatAttachmentSize(size?: number) {
  if (!size || size < 1) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

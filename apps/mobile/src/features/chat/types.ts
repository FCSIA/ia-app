import { displayName } from '~/apps/shared/user-name';
import type { ClubChannelReaction } from "~/apps/convex/src/validators";
import { isGifAttachment } from "../../../../shared/chat/gifs";

export type ChatUser = {
  _id: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  avatarUrl?: string | null;
  isDeveloper?: boolean | null;
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
  clientGeneratedId?: string;
  deliveryState?: "sending" | "failed";
  authorId: string;
  parentMessageId?: string;
  threadRootId?: string;
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
  name: string;
  description?: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY";
  viewerCanPost: boolean;
};

export type ClubChatData = {
  clubName: string;
  channel: ChatChannel;
  canCreatePolls: boolean;
  canPinMessages: boolean;
  canModerateMessages: boolean;
};

export type ClubMentionContext = {
  canMentionEveryone: boolean;
  members: Array<{
    uniqueId: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  }>;
  tags: Array<{
    slug: string;
    name: string;
  }>;
  groups: Array<{
    token: string;
    label: string;
    detail: string;
    kind: "role" | "unit";
  }>;
};

export type QuickReaction = ClubChannelReaction;

export type ComposerMode =
  | { kind: "message" }
  | { kind: "reply"; target: ChatMessage }
  | { kind: "edit"; target: ChatMessage }
  | { kind: "report"; target: ChatMessage }
  | { kind: "poll" };

export function chatAuthorName(message: ChatMessage) {
  return (
    displayName(message.author) || "Member"
  );
}

export function isImageAttachment(attachment: ChatAttachment) {
  if (isGifAttachment(attachment)) return true;
  if (attachment.mimeType) {
    return (
      attachment.mimeType.toLowerCase().startsWith("image/") &&
      attachment.mimeType.split(";", 1)[0].trim().toLowerCase() !== "image/svg+xml"
    );
  }
  const source = `${attachment.fileName} ${attachment.fileUrl}`.toLowerCase();
  return /\.(avif|gif|heic|heif|jpe?g|png|webp)(?:\?|#|\s|$)/.test(source);
}

export function isPdfAttachment(attachment: ChatAttachment) {
  if (
    attachment.mimeType?.split(";", 1)[0].trim().toLowerCase() ===
    "application/pdf"
  ) {
    return true;
  }
  return /\.pdf(?:\?|#|$)/i.test(attachment.fileName);
}

export function formatAttachmentSize(size?: number) {
  if (!size || size < 1) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

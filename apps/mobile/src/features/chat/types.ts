import type { ChannelVisibility } from "~/apps/shared/chat/protocol";
import { displayName } from '~/apps/shared/user-name';
import type { ClubChannelReaction } from "~/apps/convex/src/validators";

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
  visibility: ChannelVisibility;
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

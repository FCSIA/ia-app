import type { PaginatedQueryItem } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "~/apps/convex/src/_generated/api";
import { displayName } from '~/apps/shared/user-name';
import type { ClubChannelReaction } from "~/apps/convex/src/validators";

type ChannelsApi = typeof api.clubs.channels;

/** A message as the server returns it, plus the marker an unsent local copy carries. */
export type ChatMessage = PaginatedQueryItem<ChannelsApi["getMessagePage"]> & {
  deliveryState?: "sending";
};
export type ChatAttachment = Pick<
  ChatMessage["attachments"][number],
  "_id" | "fileName" | "fileUrl" | "mimeType" | "size"
>;
export type ChatReaction = Pick<
  ChatMessage["reactions"][number],
  "emoji" | "count" | "reactedByCurrentUser" | "countIsCapped"
>;
export type ChatPoll = NonNullable<ChatMessage["poll"]>;
export type ChatThread = NonNullable<FunctionReturnType<ChannelsApi["getThread"]>>;
export type ClubChatData = NonNullable<
  FunctionReturnType<ChannelsApi["getConversationContext"]>
>;
export type ClubMentionContext = NonNullable<
  FunctionReturnType<ChannelsApi["getMentionContext"]>
>;

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

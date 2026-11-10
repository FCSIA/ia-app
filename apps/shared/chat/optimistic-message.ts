import type { OptimisticLocalStore } from "convex/browser";
import {
  insertAtTop,
  optimisticallyUpdateValueInPaginatedQuery,
  type PaginatedQueryItem,
} from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { createOptimisticMessageShape } from "./optimistic-message-shape";

export { createClientMessageIdentity } from "./optimistic-message-shape";

/** Applies the same optimistic channel behavior on web and mobile. */
type PostMessageArgs = FunctionArgs<typeof api.clubs.channels.postMessage>;
type ToggleReactionArgs = FunctionArgs<typeof api.clubs.channels.toggleReaction>;
type ChannelPageMessage = PaginatedQueryItem<
  typeof api.clubs.channels.getMessagePage
>;
type CurrentUser = NonNullable<FunctionReturnType<typeof api.users.me.me>>;
export type OptimisticMessageAuthor = Pick<
  CurrentUser,
  | "_id"
  | "uniqueId"
  | "firstName"
  | "lastName"
  | "preferredName"
  | "email"
  | "roles"
  | "avatarUrl"
>;

export type OptimisticChatMessage = ChannelPageMessage & {
  clientGeneratedId: string;
  deliveryState: "sending";
};

type OptimisticMessageContext = {
  clubId: Id<"clubs">;
  author: OptimisticMessageAuthor;
};

export function createOptimisticMessage(
  args: PostMessageArgs,
  author: OptimisticMessageAuthor,
): OptimisticChatMessage | null {
  return createOptimisticMessageShape(
    args,
    author,
  ) as OptimisticChatMessage | null;
}

export function optimisticallyInsertPostedMessage(
  localStore: OptimisticLocalStore,
  args: PostMessageArgs,
  context: OptimisticMessageContext,
) {
  const optimisticMessage = createOptimisticMessage(args, context.author);
  if (!optimisticMessage) return;

  if (!args.parentMessageId) {
    insertAtTop({
      paginatedQuery: api.clubs.channels.getMessagePage,
      argsToMatch: {
        clubId: context.clubId,
        channelId: args.channelId,
      },
      localQueryStore: localStore,
      item: optimisticMessage,
    });
    return;
  }

  optimisticallyUpdateValueInPaginatedQuery(
    localStore,
    api.clubs.channels.getMessagePage,
    { clubId: context.clubId, channelId: args.channelId },
    (message) => {
      if (message._id !== args.parentMessageId) return message;
      return {
        ...message,
        hasReplies: true,
        replyCount: message.replyCount + 1,
        latestReplyPreview: {
          _id: optimisticMessage._id,
          body: optimisticMessage.body,
          isDeleted: false,
          createdAt: optimisticMessage.createdAt,
        },
      };
    },
  );

  const threadArgs = {
    clubId: context.clubId,
    channelId: args.channelId,
    messageId: args.parentMessageId,
  };
  const thread = localStore.getQuery(
    api.clubs.channels.getThread,
    threadArgs,
  );
  if (!thread) return;
  localStore.setQuery(api.clubs.channels.getThread, threadArgs, {
    ...thread,
    replies: [
      ...thread.replies.filter(
        (message) => message._id !== optimisticMessage._id,
      ),
      optimisticMessage,
    ],
  });
}

function toggleReactionOnMessage(
  message: ChannelPageMessage,
  args: ToggleReactionArgs,
  currentUserId: Id<"users">,
) {
  if (message._id !== args.messageId) return message;
  const existing = message.reactions.find((reaction) => reaction.emoji === args.emoji);

  if (!existing) {
    return {
      ...message,
      reactions: [
        ...message.reactions,
        {
          emoji: args.emoji,
          count: 1,
          reactedByCurrentUser: true,
          reactors: [],
          countIsCapped: false,
        },
      ],
    };
  }

  if (existing.reactedByCurrentUser && existing.count <= 1) {
    return {
      ...message,
      reactions: message.reactions.filter((reaction) => reaction.emoji !== args.emoji),
    };
  }

  return {
    ...message,
    reactions: message.reactions.map((reaction) =>
      reaction.emoji === args.emoji
        ? {
            ...reaction,
            count: Math.max(0, reaction.count + (reaction.reactedByCurrentUser ? -1 : 1)),
            reactedByCurrentUser: !reaction.reactedByCurrentUser,
            reactors: reaction.reactedByCurrentUser
              ? reaction.reactors.filter((reactor) => reactor._id !== currentUserId)
              : reaction.reactors,
          }
        : reaction,
    ),
  };
}

export function optimisticallyToggleMessageReaction(
  localStore: OptimisticLocalStore,
  args: ToggleReactionArgs,
  context: {
    clubId: Id<"clubs">;
    channelId: Id<"clubChannels">;
    currentUserId: Id<"users">;
    threadId?: Id<"clubChannelMessages"> | null;
  },
) {
  optimisticallyUpdateValueInPaginatedQuery(
    localStore,
    api.clubs.channels.getMessagePage,
    { clubId: context.clubId, channelId: context.channelId },
    (message) => toggleReactionOnMessage(message, args, context.currentUserId),
  );

  if (!context.threadId) return;
  const threadArgs = {
    clubId: context.clubId,
    channelId: context.channelId,
    messageId: context.threadId,
  };
  const thread = localStore.getQuery(api.clubs.channels.getThread, threadArgs);
  if (!thread) return;
  localStore.setQuery(api.clubs.channels.getThread, threadArgs, {
    ...thread,
    root: toggleReactionOnMessage(thread.root, args, context.currentUserId),
    replies: thread.replies.map((message) =>
      toggleReactionOnMessage(message, args, context.currentUserId),
    ),
  });
}

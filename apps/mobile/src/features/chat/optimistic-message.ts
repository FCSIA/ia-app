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

type PostMessageArgs = FunctionArgs<typeof api.clubs.channels.postMessage>;
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

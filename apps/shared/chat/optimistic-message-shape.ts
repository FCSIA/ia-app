/** Framework-neutral shape used by both chat clients. */
export type OptimisticMessageShapeAuthor = {
  _id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email?: string | null;
  roles: readonly string[];
  avatarUrl?: string | null;
};

export type OptimisticMessageShapeInput = {
  channelId: string;
  body: string;
  bodyMarkdown?: string;
  bodyRich?: unknown;
  parentMessageId?: string;
  replyToMessageId?: string;
  pollQuestion?: string;
  pollOptions?: Array<{ id: string; label: string }>;
  clientGeneratedId?: string;
  clientSentAt?: number;
};

let clientMessageSequence = 0;

export function createClientMessageIdentity(now = Date.now()) {
  clientMessageSequence = (clientMessageSequence + 1) % 1_000_000;
  return {
    clientGeneratedId: `${now.toString(36)}-${clientMessageSequence.toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    clientSentAt: now,
  };
}

export function createOptimisticMessageShape(
  args: OptimisticMessageShapeInput,
  author: OptimisticMessageShapeAuthor,
) {
  if (!args.clientGeneratedId || !Number.isFinite(args.clientSentAt)) {
    return null;
  }
  const sentAt = args.clientSentAt as number;
  const createdAt = new Date(sentAt).toISOString();
  const optimisticId = `optimistic:${args.clientGeneratedId}`;
  const poll =
    args.pollQuestion && args.pollOptions?.length
      ? {
          question: args.pollQuestion,
          options: args.pollOptions.map((option) => ({
            ...option,
            count: 0,
            votedByCurrentUser: false,
          })),
          totalVotes: 0,
          votesTruncated: false,
        }
      : null;

  return {
    _id: optimisticId,
    _creationTime: sentAt,
    channelId: args.channelId,
    authorId: author._id,
    parentMessageId: args.parentMessageId,
    replyToMessageId: args.replyToMessageId,
    body: args.body.trim(),
    bodyMarkdown: args.bodyMarkdown?.trim() || undefined,
    bodyRich: args.bodyRich,
    isPinned: false,
    pinnedAt: null,
    pollQuestion: args.pollQuestion,
    pollOptions: args.pollOptions,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    threadRootId: args.parentMessageId ?? optimisticId,
    author: {
      _id: author._id,
      uniqueId: author.uniqueId,
      firstName: author.firstName,
      lastName: author.lastName,
      preferredName: author.preferredName,
      email: author.email ?? null,
      roles: [...author.roles],
      avatarUrl: author.avatarUrl ?? null,
    },
    mentions: [],
    attachments: [],
    attachmentsTruncated: false,
    reactions: [],
    reactionsTruncated: false,
    replies: [],
    replyCount: 0,
    replyCountIsExact: true,
    hasReplies: false,
    latestReplyPreview: null,
    poll,
    isDeleted: false,
    clientGeneratedId: args.clientGeneratedId,
    deliveryState: "sending" as const,
  };
}

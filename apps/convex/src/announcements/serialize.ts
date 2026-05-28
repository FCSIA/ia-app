import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function serializeAnnouncement(
  ctx: QueryCtx,
  ann: Doc<"announcements">,
  userId: Id<"users">,
) {
  const author = await ctx.db.get(ann.authorId);
  const club = ann.clubId ? await ctx.db.get(ann.clubId) : null;

  const read = await ctx.db
    .query("announcementReads")
    .withIndex("by_announcementId_and_userId", (q) =>
      q.eq("announcementId", ann._id).eq("userId", userId),
    )
    .first();

  const bookmark = await ctx.db
    .query("announcementBookmarks")
    .withIndex("by_announcementId_and_userId", (q) =>
      q.eq("announcementId", ann._id).eq("userId", userId),
    )
    .first();

  const comments = await ctx.db
    .query("comments")
    .withIndex("by_announcementId", (q) => q.eq("announcementId", ann._id))
    .collect();

  const isPinned = !!ann.promotedUntil && ann.promotedUntil > Date.now();

  return {
    ...ann,
    isRead: !!read,
    readAt: read?.readAt,
    isBookmarked: !!bookmark,
    isPinned,
    author: author
      ? { _id: author._id, firstName: author.firstName, lastName: author.lastName }
      : null,
    club: club ? { _id: club._id, name: club.name } : null,
    commentCount: comments.length,
  };
}

export async function serializeComment(ctx: QueryCtx, comment: Doc<"comments">) {
  const author = await ctx.db.get(comment.authorId);
  return {
    ...comment,
    author: author
      ? { _id: author._id, firstName: author.firstName, lastName: author.lastName }
      : null,
  };
}

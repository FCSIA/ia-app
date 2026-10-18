import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { createDocLoader, type DocLoader } from "../../lib/docLoader";

/**
 * Shared per-query state for announcement serialization.
 *
 * A feed repeats the same authors and clubs across dozens of rows, so the
 * document loader turns those into one read each. Storage URLs are memoized for
 * the same reason: two announcements that embed the same file used to resolve it
 * twice.
 */
type SerializeScope = {
  loader: DocLoader;
  storageUrls: Map<string, Promise<string | null>>;
};

function scopeFor(ctx: QueryCtx, scope?: SerializeScope): SerializeScope {
  return scope ?? { loader: createDocLoader(ctx), storageUrls: new Map() };
}

function storageUrl(ctx: QueryCtx, scope: SerializeScope, storageId: Id<"_storage">) {
  let pending = scope.storageUrls.get(storageId);
  if (!pending) {
    pending = ctx.storage.getUrl(storageId);
    scope.storageUrls.set(storageId, pending);
  }
  return pending;
}

function serializeAuthor(author: Doc<"users"> | null) {
  return author
    ? {
        _id: author._id,
        firstName: author.firstName,
        lastName: author.lastName,
        avatarUrl: author.avatarUrl ?? null,
        roles: author.roles,
        isDeveloper: author.isDeveloper,
      }
    : null;
}

export async function serializeAnnouncement(
  ctx: QueryCtx,
  ann: Doc<"announcements">,
  userId: Id<"users">,
  now: number,
  sharedScope?: SerializeScope,
) {
  const scope = scopeFor(ctx, sharedScope);
  const [author, club, read, bookmark, pin, images] = await Promise.all([
    scope.loader.get(ann.authorId),
    ann.clubId ? scope.loader.get(ann.clubId) : Promise.resolve(null),
    ctx.db
      .query("announcementReads")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", ann._id).eq("userId", userId),
      )
      .first(),
    ctx.db
      .query("announcementBookmarks")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", ann._id).eq("userId", userId),
      )
      .first(),
    ctx.db
      .query("announcementPins")
      .withIndex("by_announcementId_and_userId", (q) =>
        q.eq("announcementId", ann._id).eq("userId", userId),
      )
      .first(),
    ctx.db
      .query("announcementImages")
      .withIndex("by_announcementId_and_createdAt", (q) => q.eq("announcementId", ann._id))
      .collect(),
  ]);

  // `commentCount` is maintained by the comment mutations. Older rows predate
  // the counter, so they fall back to counting — reading every comment body just
  // to render "3 comments" is what the counter exists to avoid.
  const commentCount =
    ann.commentCount ??
    (
      await ctx.db
        .query("comments")
        .withIndex("by_announcementId", (q) => q.eq("announcementId", ann._id))
        .collect()
    ).length;

  const isPromoted = !!ann.promotedUntil && ann.promotedUntil > now;

  return {
    ...ann,
    isRead: !!read,
    readAt: read?.readAt,
    isBookmarked: !!bookmark,
    isPinned: !!pin,
    isPromoted,
    author: serializeAuthor(author),
    club: club ? { _id: club._id, name: club.name } : null,
    commentCount,
    images: (
      await Promise.all(
        images.map(async (image) => {
          const url = await storageUrl(ctx, scope, image.storageId);
          return url
            ? { _id: image._id, url, mimeType: image.mimeType, size: image.size }
            : null;
        }),
      )
    ).filter((image): image is NonNullable<typeof image> => image !== null),
  };
}

/** Serialize a whole feed, sharing one document and storage-URL cache across it. */
export async function serializeAnnouncements(
  ctx: QueryCtx,
  announcements: Doc<"announcements">[],
  userId: Id<"users">,
  now: number,
) {
  const scope = scopeFor(ctx);
  return Promise.all(
    announcements.map((ann) => serializeAnnouncement(ctx, ann, userId, now, scope)),
  );
}

async function serializeComment(
  ctx: QueryCtx,
  comment: Doc<"comments">,
  loader: DocLoader = createDocLoader(ctx),
) {
  const author = await loader.get(comment.authorId);
  return {
    ...comment,
    author: serializeAuthor(author),
  };
}

/** Serialize a comment thread, reading each distinct author once. */
export async function serializeComments(ctx: QueryCtx, comments: Doc<"comments">[]) {
  const loader = createDocLoader(ctx);
  return Promise.all(comments.map((comment) => serializeComment(ctx, comment, loader)));
}

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { docs } from "../../lib/docs";

export const announcementListItemValidator = docs.announcements.extend({
  isRead: v.boolean(),
  readAt: v.optional(v.number()),
  isBookmarked: v.boolean(),
  isPinned: v.boolean(),
  author: v.union(
    v.object({
      _id: v.id("users"),
      firstName: v.string(),
      lastName: v.string(),
    }),
    v.null(),
  ),
  club: v.union(
    v.object({
      _id: v.id("clubs"),
      name: v.string(),
    }),
    v.null(),
  ),
  commentCount: v.number(),
});

export const commentWithAuthorValidator = docs.comments.extend({
  author: v.union(
    v.object({
      _id: v.id("users"),
      firstName: v.string(),
      lastName: v.string(),
    }),
    v.null(),
  ),
});

export function isElevatedReader(roles: string[]) {
  return (
    roles.includes("ADMIN") ||
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TEACHER")
  );
}

export async function getViewerAudience(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const viewer = await ctx.db.get(userId);
  if (!viewer) throw new Error("User not found");
  return {
    gradeLevel: viewer.gradeLevel,
    major: viewer.major,
    minor: viewer.minor,
  };
}

export async function getAccessibleClubIds(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("clubMembers")
    .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", userId))
    .collect();
  const sponsors = await ctx.db
    .query("clubSponsors")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const ids = new Set<Id<"clubs">>();
  for (const row of memberships) ids.add(row.clubId);
  for (const row of sponsors) ids.add(row.clubId);
  return Array.from(ids);
}

function matchesPathway(
  ann: Doc<"announcements">,
  pathways: Array<string | undefined>,
) {
  const targets = pathways.filter((p): p is string => !!p);
  if (targets.length === 0) return false;
  if (ann.targetPathway && targets.includes(ann.targetPathway)) return true;
  if (ann.targetMajorPathways.some((p) => targets.includes(p))) return true;
  if (ann.targetMinorPathways.some((p) => targets.includes(p))) return true;
  return false;
}

function matchesGrade(ann: Doc<"announcements">, gradeLevel?: number) {
  if (gradeLevel == null) return false;
  if (ann.targetGrade === gradeLevel) return true;
  return ann.targetGrades.includes(gradeLevel);
}

export function canViewAnnouncement(
  ann: Doc<"announcements">,
  userId: Id<"users">,
  roles: string[],
  accessibleClubIds: Id<"clubs">[],
  viewer: Awaited<ReturnType<typeof getViewerAudience>>,
) {
  if (ann.authorId === userId) return true;
  if (isElevatedReader(roles)) return true;

  if (ann.status !== "ACTIVE") return false;

  const pathwayTargets = [viewer.major, viewer.minor].filter(
    (value): value is NonNullable<typeof value> => value != null,
  );

  if (ann.targetType === "SCHOOL_WIDE" && !ann.clubId) return true;

  if (ann.targetType === "GRADE" && !ann.clubId) {
    return matchesGrade(ann, viewer.gradeLevel ?? undefined);
  }

  if (ann.targetType === "PATHWAY" && !ann.clubId) {
    return matchesPathway(ann, pathwayTargets);
  }

  if (ann.targetType === "CLUB" && ann.clubId) {
    return accessibleClubIds.includes(ann.clubId);
  }

  if (ann.targetType === "INTERSECTION") {
    const gradeOk =
      ann.targetGrades.length === 0 && ann.targetGrade == null
        ? true
        : matchesGrade(ann, viewer.gradeLevel ?? undefined);
    const pathwayOk =
      !ann.targetPathway &&
      ann.targetMajorPathways.length === 0 &&
      ann.targetMinorPathways.length === 0
        ? true
        : matchesPathway(ann, pathwayTargets);
    const clubOk = !ann.clubId || accessibleClubIds.includes(ann.clubId);
    return gradeOk && pathwayOk && clubOk;
  }

  return false;
}

export async function assertAnnouncementAccess(
  ctx: QueryCtx | MutationCtx,
  ann: Doc<"announcements">,
  userId: Id<"users">,
  roles: string[],
) {
  const viewer = await getViewerAudience(ctx, userId);
  const clubs = await getAccessibleClubIds(ctx, userId);
  if (!canViewAnnouncement(ann, userId, roles, clubs, viewer)) {
    throw new Error("Announcement not found");
  }
}

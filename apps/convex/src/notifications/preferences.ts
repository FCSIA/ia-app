import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import type { Doc } from "../_generated/dataModel";
import { assertAnnouncementAccess } from "../announcements/_lib";
import { canReadChannel, getViewerContext } from "../clubs/access";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
} from "../validators";
import { preferenceValidator, scopeKey, toPreference } from "./_lib";

type PreferenceScopeArgs = {
  clubId?: string;
  channelId?: string;
  announcementId?: string;
  eventId?: string;
  scopeKey?: string;
};

function isGlobalEventManager(user: Doc<"users">) {
  return user.roles.some((role) =>
    ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "STUDENT_ADMIN"].includes(role),
  );
}

async function validatePreferenceScope(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: PreferenceScopeArgs,
) {
  const specificScopes = [
    args.channelId,
    args.announcementId,
    args.eventId,
  ].filter(Boolean);
  if (specificScopes.length > 1) {
    throw new ConvexError("Notification preference scope is ambiguous.");
  }

  if (args.channelId) {
    const channelId = ctx.db.normalizeId("clubChannels", args.channelId);
    if (!channelId) throw new ConvexError("Channel not found.");
    const channel = await ctx.db.get(channelId);
    if (!channel) throw new ConvexError("Channel not found.");
    if (args.clubId && args.clubId !== channel.clubId) {
      throw new ConvexError("Channel does not belong to this club.");
    }

    const context = await getViewerContext(ctx, channel.clubId, user);
    const memberships = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channelId))
      .collect();
    if (!canReadChannel({ ...channel, memberships }, context, user._id)) {
      throw new ConvexError("Not authorized.");
    }

    return {
      key: `channel:${channelId}`,
      clubId: channel.clubId,
      channelId,
      announcementId: undefined,
      eventId: undefined,
    };
  }

  if (args.announcementId) {
    const announcementId = ctx.db.normalizeId("announcements", args.announcementId);
    if (!announcementId) throw new ConvexError("Announcement not found.");
    const announcement = await ctx.db.get(announcementId);
    if (!announcement) throw new ConvexError("Announcement not found.");
    if (args.clubId && announcement.clubId !== args.clubId) {
      throw new ConvexError("Announcement does not belong to this club.");
    }
    await assertAnnouncementAccess(ctx, announcement, user._id, user.roles);

    return {
      key: `announcement:${announcementId}`,
      clubId: announcement.clubId,
      channelId: undefined,
      announcementId,
      eventId: undefined,
    };
  }

  if (args.eventId) {
    const eventId = ctx.db.normalizeId("events", args.eventId);
    if (!eventId) throw new ConvexError("Event not found.");
    const event = await ctx.db.get(eventId);
    if (!event) throw new ConvexError("Event not found.");
    if (args.clubId && event.clubId !== args.clubId) {
      throw new ConvexError("Event does not belong to this club.");
    }

    const canView =
      event.status === "PUBLISHED" ||
      event.authorId === user._id ||
      isGlobalEventManager(user);
    if (!canView) throw new ConvexError("Not authorized.");
    if (event.clubId && !isGlobalEventManager(user)) {
      const context = await getViewerContext(ctx, event.clubId, user);
      if (!context.canAccessWorkspace) throw new ConvexError("Not authorized.");
    }

    return {
      key: `event:${eventId}`,
      clubId: event.clubId,
      channelId: undefined,
      announcementId: undefined,
      eventId,
    };
  }

  if (args.clubId) {
    const clubId = ctx.db.normalizeId("clubs", args.clubId);
    if (!clubId) throw new ConvexError("Club not found.");
    const context = await getViewerContext(ctx, clubId, user);
    if (!context.canAccessWorkspace) throw new ConvexError("Not authorized.");

    return {
      key: `club:${clubId}`,
      clubId,
      channelId: undefined,
      announcementId: undefined,
      eventId: undefined,
    };
  }

  const key = scopeKey(args);
  if (key !== "global") {
    throw new ConvexError("Scoped notification preferences require an accessible record.");
  }
  return {
    key: "global",
    clubId: undefined,
    channelId: undefined,
    announcementId: undefined,
    eventId: undefined,
  };
}

export const list = query({
  args: {},
  returns: v.array(preferenceValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", user._id),
      )
      .take(500);
    return rows.map(toPreference);
  },
});

export const upsert = mutation({
  args: {
    category: notificationCategoryValidator,
    enabled: v.boolean(),
    clubId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    announcementId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    scopeKey: v.optional(v.string()),
    level: v.optional(notificationPreferenceLevelValidator),
  },
  returns: preferenceValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const scope = await validatePreferenceScope(ctx, user, args);
    const key = scope.key;
    const level = args.level ?? (args.enabled ? "PUSH" : "OFF");
    const enabled = args.enabled && level !== "OFF";
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", user._id).eq("category", args.category).eq("scopeKey", key),
      )
      .unique();

    if (existing?.locked) return toPreference(existing);

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled,
        level,
        clubId: scope.clubId,
        channelId: scope.channelId,
        announcementId: scope.announcementId,
        eventId: scope.eventId,
        updatedAt: now,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new ConvexError("Preference not found.");
      return toPreference(updated);
    }

    const id = await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      category: args.category,
      enabled,
      level,
      locked: false,
      clubId: scope.clubId,
      channelId: scope.channelId,
      announcementId: scope.announcementId,
      eventId: scope.eventId,
      scopeKey: key,
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new ConvexError("Preference not found.");
    return toPreference(created);
  },
});

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as announcements__lib from "../announcements/_lib.js";
import type * as announcements_comments from "../announcements/comments.js";
import type * as announcements_engagement from "../announcements/engagement.js";
import type * as announcements_feed from "../announcements/feed.js";
import type * as announcements_seed from "../announcements/seed.js";
import type * as announcements_serialize from "../announcements/serialize.js";
import type * as audit__lib from "../audit/_lib.js";
import type * as audit_events from "../audit/events.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as clubs__lib from "../clubs/_lib.js";
import type * as clubs_access from "../clubs/access.js";
import type * as clubs_channels from "../clubs/channels.js";
import type * as clubs_detail from "../clubs/detail.js";
import type * as clubs_invitations from "../clubs/invitations.js";
import type * as clubs_management from "../clubs/management.js";
import type * as clubs_seed from "../clubs/seed.js";
import type * as clubs_serialize from "../clubs/serialize.js";
import type * as clubs_tags from "../clubs/tags.js";
import type * as courses__lib from "../courses/_lib.js";
import type * as courses_catalog from "../courses/catalog.js";
import type * as courses_seed from "../courses/seed.js";
import type * as events__lib from "../events/_lib.js";
import type * as events_approvals from "../events/approvals.js";
import type * as events_calendar from "../events/calendar.js";
import type * as events_events from "../events/events.js";
import type * as events_serialize from "../events/serialize.js";
import type * as flexFriday__lib from "../flexFriday/_lib.js";
import type * as flexFriday_attendance from "../flexFriday/attendance.js";
import type * as flexFriday_credits from "../flexFriday/credits.js";
import type * as flexFriday_fridays from "../flexFriday/fridays.js";
import type * as flexFriday_registration from "../flexFriday/registration.js";
import type * as flexFriday_sessions from "../flexFriday/sessions.js";
import type * as flexFriday_workshops from "../flexFriday/workshops.js";
import type * as http from "../http.js";
import type * as moderation_keywords from "../moderation/keywords.js";
import type * as moderation_reports from "../moderation/reports.js";
import type * as notifications__lib from "../notifications/_lib.js";
import type * as notifications_delivery from "../notifications/delivery.js";
import type * as notifications_inbox from "../notifications/inbox.js";
import type * as notifications_preferences from "../notifications/preferences.js";
import type * as notifications_push from "../notifications/push.js";
import type * as notifications_pushNode from "../notifications/pushNode.js";
import type * as schedule__lib from "../schedule/_lib.js";
import type * as schedule_blocks from "../schedule/blocks.js";
import type * as schedule_dashboard from "../schedule/dashboard.js";
import type * as schedule_friends from "../schedule/friends.js";
import type * as schedule_seed from "../schedule/seed.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as uploads_files from "../uploads/files.js";
import type * as users__lib from "../users/_lib.js";
import type * as users_admin from "../users/admin.js";
import type * as users_auth from "../users/auth.js";
import type * as users_me from "../users/me.js";
import type * as validators from "../validators.js";
import type * as wrapped__lib from "../wrapped/_lib.js";
import type * as wrapped_snapshots from "../wrapped/snapshots.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "announcements/_lib": typeof announcements__lib;
  "announcements/comments": typeof announcements_comments;
  "announcements/engagement": typeof announcements_engagement;
  "announcements/feed": typeof announcements_feed;
  "announcements/seed": typeof announcements_seed;
  "announcements/serialize": typeof announcements_serialize;
  "audit/_lib": typeof audit__lib;
  "audit/events": typeof audit_events;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  "clubs/_lib": typeof clubs__lib;
  "clubs/access": typeof clubs_access;
  "clubs/channels": typeof clubs_channels;
  "clubs/detail": typeof clubs_detail;
  "clubs/invitations": typeof clubs_invitations;
  "clubs/management": typeof clubs_management;
  "clubs/seed": typeof clubs_seed;
  "clubs/serialize": typeof clubs_serialize;
  "clubs/tags": typeof clubs_tags;
  "courses/_lib": typeof courses__lib;
  "courses/catalog": typeof courses_catalog;
  "courses/seed": typeof courses_seed;
  "events/_lib": typeof events__lib;
  "events/approvals": typeof events_approvals;
  "events/calendar": typeof events_calendar;
  "events/events": typeof events_events;
  "events/serialize": typeof events_serialize;
  "flexFriday/_lib": typeof flexFriday__lib;
  "flexFriday/attendance": typeof flexFriday_attendance;
  "flexFriday/credits": typeof flexFriday_credits;
  "flexFriday/fridays": typeof flexFriday_fridays;
  "flexFriday/registration": typeof flexFriday_registration;
  "flexFriday/sessions": typeof flexFriday_sessions;
  "flexFriday/workshops": typeof flexFriday_workshops;
  http: typeof http;
  "moderation/keywords": typeof moderation_keywords;
  "moderation/reports": typeof moderation_reports;
  "notifications/_lib": typeof notifications__lib;
  "notifications/delivery": typeof notifications_delivery;
  "notifications/inbox": typeof notifications_inbox;
  "notifications/preferences": typeof notifications_preferences;
  "notifications/push": typeof notifications_push;
  "notifications/pushNode": typeof notifications_pushNode;
  "schedule/_lib": typeof schedule__lib;
  "schedule/blocks": typeof schedule_blocks;
  "schedule/dashboard": typeof schedule_dashboard;
  "schedule/friends": typeof schedule_friends;
  "schedule/seed": typeof schedule_seed;
  seed: typeof seed;
  stats: typeof stats;
  "uploads/files": typeof uploads_files;
  "users/_lib": typeof users__lib;
  "users/admin": typeof users_admin;
  "users/auth": typeof users_auth;
  "users/me": typeof users_me;
  validators: typeof validators;
  "wrapped/_lib": typeof wrapped__lib;
  "wrapped/snapshots": typeof wrapped_snapshots;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};

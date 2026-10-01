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
import type * as announcements_contentValidation from "../announcements/contentValidation.js";
import type * as announcements_engagement from "../announcements/engagement.js";
import type * as announcements_feed from "../announcements/feed.js";
import type * as announcements_migrations from "../announcements/migrations.js";
import type * as announcements_seed from "../announcements/seed.js";
import type * as announcements_serialize from "../announcements/serialize.js";
import type * as audit__lib from "../audit/_lib.js";
import type * as audit_events from "../audit/events.js";
import type * as auth from "../auth.js";
import type * as auth_loginRateLimitPlugin from "../auth/loginRateLimitPlugin.js";
import type * as authLoginRateLimit from "../authLoginRateLimit.js";
import type * as bootstrap from "../bootstrap.js";
import type * as clubs__lib from "../clubs/_lib.js";
import type * as clubs_access from "../clubs/access.js";
import type * as clubs_channelAccess from "../clubs/channelAccess.js";
import type * as clubs_channelDeletion from "../clubs/channelDeletion.js";
import type * as clubs_channelDeletionPolicy from "../clubs/channelDeletionPolicy.js";
import type * as clubs_channelMarkdown from "../clubs/channelMarkdown.js";
import type * as clubs_channelMentions from "../clubs/channelMentions.js";
import type * as clubs_channelNotificationCopy from "../clubs/channelNotificationCopy.js";
import type * as clubs_channelPagination from "../clubs/channelPagination.js";
import type * as clubs_channelReactions from "../clubs/channelReactions.js";
import type * as clubs_channelValidation from "../clubs/channelValidation.js";
import type * as clubs_channels from "../clubs/channels.js";
import type * as clubs_clubDeletion from "../clubs/clubDeletion.js";
import type * as clubs_counts from "../clubs/counts.js";
import type * as clubs_detail from "../clubs/detail.js";
import type * as clubs_hierarchy from "../clubs/hierarchy.js";
import type * as clubs_hierarchyRules from "../clubs/hierarchyRules.js";
import type * as clubs_invitations from "../clubs/invitations.js";
import type * as clubs_management from "../clubs/management.js";
import type * as clubs_migrations from "../clubs/migrations.js";
import type * as clubs_peopleGroups from "../clubs/peopleGroups.js";
import type * as clubs_rolePermissions from "../clubs/rolePermissions.js";
import type * as clubs_seed from "../clubs/seed.js";
import type * as clubs_serialize from "../clubs/serialize.js";
import type * as clubs_shared from "../clubs/shared.js";
import type * as clubs_sharedPagination from "../clubs/sharedPagination.js";
import type * as clubs_tags from "../clubs/tags.js";
import type * as courses__lib from "../courses/_lib.js";
import type * as courses_catalog from "../courses/catalog.js";
import type * as courses_metadata from "../courses/metadata.js";
import type * as courses_seed from "../courses/seed.js";
import type * as crons from "../crons.js";
import type * as events__lib from "../events/_lib.js";
import type * as events_approvals from "../events/approvals.js";
import type * as events_calendar from "../events/calendar.js";
import type * as events_calendarInvitePolicy from "../events/calendarInvitePolicy.js";
import type * as events_contentValidation from "../events/contentValidation.js";
import type * as events_events from "../events/events.js";
import type * as events_externalCalendarSync from "../events/externalCalendarSync.js";
import type * as events_externalCalendars from "../events/externalCalendars.js";
import type * as events_serialize from "../events/serialize.js";
import type * as flexFriday__lib from "../flexFriday/_lib.js";
import type * as flexFriday_attendance from "../flexFriday/attendance.js";
import type * as flexFriday_counts from "../flexFriday/counts.js";
import type * as flexFriday_credits from "../flexFriday/credits.js";
import type * as flexFriday_fridays from "../flexFriday/fridays.js";
import type * as flexFriday_migrations from "../flexFriday/migrations.js";
import type * as flexFriday_permissions from "../flexFriday/permissions.js";
import type * as flexFriday_registration from "../flexFriday/registration.js";
import type * as flexFriday_sessions from "../flexFriday/sessions.js";
import type * as flexFriday_workshops from "../flexFriday/workshops.js";
import type * as http from "../http.js";
import type * as moderation_feedbackAccess from "../moderation/feedbackAccess.js";
import type * as moderation_keywords from "../moderation/keywords.js";
import type * as moderation_reportValidation from "../moderation/reportValidation.js";
import type * as moderation_reports from "../moderation/reports.js";
import type * as notifications__lib from "../notifications/_lib.js";
import type * as notifications__pushActivation from "../notifications/_pushActivation.js";
import type * as notifications__pushDevices from "../notifications/_pushDevices.js";
import type * as notifications__pushOwnership from "../notifications/_pushOwnership.js";
import type * as notifications__subscriptionPruning from "../notifications/_subscriptionPruning.js";
import type * as notifications_delivery from "../notifications/delivery.js";
import type * as notifications_deliveryPreference from "../notifications/deliveryPreference.js";
import type * as notifications_inbox from "../notifications/inbox.js";
import type * as notifications_migrations from "../notifications/migrations.js";
import type * as notifications_preferences from "../notifications/preferences.js";
import type * as notifications_push from "../notifications/push.js";
import type * as notifications_pushDevices from "../notifications/pushDevices.js";
import type * as notifications_pushExpo from "../notifications/pushExpo.js";
import type * as notifications_pushNode from "../notifications/pushNode.js";
import type * as rateLimits from "../rateLimits.js";
import type * as schedule__lib from "../schedule/_lib.js";
import type * as schedule_blocks from "../schedule/blocks.js";
import type * as schedule_dashboard from "../schedule/dashboard.js";
import type * as schedule_dayPlans from "../schedule/dayPlans.js";
import type * as schedule_dayResolver from "../schedule/dayResolver.js";
import type * as schedule_friends from "../schedule/friends.js";
import type * as schedule_groupComparison from "../schedule/groupComparison.js";
import type * as schedule_groupPolicy from "../schedule/groupPolicy.js";
import type * as schedule_groups from "../schedule/groups.js";
import type * as schedule_importOcr from "../schedule/importOcr.js";
import type * as schedule_migrations from "../schedule/migrations.js";
import type * as schedule_scheduleChangeNotifications from "../schedule/scheduleChangeNotifications.js";
import type * as schedule_seed from "../schedule/seed.js";
import type * as schedule_shareLinkSecurity from "../schedule/shareLinkSecurity.js";
import type * as schedule_shareLinks from "../schedule/shareLinks.js";
import type * as search_global from "../search/global.js";
import type * as seed from "../seed.js";
import type * as stats from "../stats.js";
import type * as uploads_announcementImages from "../uploads/announcementImages.js";
import type * as uploads_chatAttachments from "../uploads/chatAttachments.js";
import type * as uploads_feedbackImages from "../uploads/feedbackImages.js";
import type * as uploads_fileSignatures from "../uploads/fileSignatures.js";
import type * as uploads_files from "../uploads/files.js";
import type * as uploads_limits from "../uploads/limits.js";
import type * as uploads_orphanCleanup from "../uploads/orphanCleanup.js";
import type * as uploads_quota from "../uploads/quota.js";
import type * as uploads_uploadIntents from "../uploads/uploadIntents.js";
import type * as users__lib from "../users/_lib.js";
import type * as users_admin from "../users/admin.js";
import type * as users_auth from "../users/auth.js";
import type * as users_dashboardLayout from "../users/dashboardLayout.js";
import type * as users_impersonation from "../users/impersonation.js";
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
  "announcements/contentValidation": typeof announcements_contentValidation;
  "announcements/engagement": typeof announcements_engagement;
  "announcements/feed": typeof announcements_feed;
  "announcements/migrations": typeof announcements_migrations;
  "announcements/seed": typeof announcements_seed;
  "announcements/serialize": typeof announcements_serialize;
  "audit/_lib": typeof audit__lib;
  "audit/events": typeof audit_events;
  auth: typeof auth;
  "auth/loginRateLimitPlugin": typeof auth_loginRateLimitPlugin;
  authLoginRateLimit: typeof authLoginRateLimit;
  bootstrap: typeof bootstrap;
  "clubs/_lib": typeof clubs__lib;
  "clubs/access": typeof clubs_access;
  "clubs/channelAccess": typeof clubs_channelAccess;
  "clubs/channelDeletion": typeof clubs_channelDeletion;
  "clubs/channelDeletionPolicy": typeof clubs_channelDeletionPolicy;
  "clubs/channelMarkdown": typeof clubs_channelMarkdown;
  "clubs/channelMentions": typeof clubs_channelMentions;
  "clubs/channelNotificationCopy": typeof clubs_channelNotificationCopy;
  "clubs/channelPagination": typeof clubs_channelPagination;
  "clubs/channelReactions": typeof clubs_channelReactions;
  "clubs/channelValidation": typeof clubs_channelValidation;
  "clubs/channels": typeof clubs_channels;
  "clubs/clubDeletion": typeof clubs_clubDeletion;
  "clubs/counts": typeof clubs_counts;
  "clubs/detail": typeof clubs_detail;
  "clubs/hierarchy": typeof clubs_hierarchy;
  "clubs/hierarchyRules": typeof clubs_hierarchyRules;
  "clubs/invitations": typeof clubs_invitations;
  "clubs/management": typeof clubs_management;
  "clubs/migrations": typeof clubs_migrations;
  "clubs/peopleGroups": typeof clubs_peopleGroups;
  "clubs/rolePermissions": typeof clubs_rolePermissions;
  "clubs/seed": typeof clubs_seed;
  "clubs/serialize": typeof clubs_serialize;
  "clubs/shared": typeof clubs_shared;
  "clubs/sharedPagination": typeof clubs_sharedPagination;
  "clubs/tags": typeof clubs_tags;
  "courses/_lib": typeof courses__lib;
  "courses/catalog": typeof courses_catalog;
  "courses/metadata": typeof courses_metadata;
  "courses/seed": typeof courses_seed;
  crons: typeof crons;
  "events/_lib": typeof events__lib;
  "events/approvals": typeof events_approvals;
  "events/calendar": typeof events_calendar;
  "events/calendarInvitePolicy": typeof events_calendarInvitePolicy;
  "events/contentValidation": typeof events_contentValidation;
  "events/events": typeof events_events;
  "events/externalCalendarSync": typeof events_externalCalendarSync;
  "events/externalCalendars": typeof events_externalCalendars;
  "events/serialize": typeof events_serialize;
  "flexFriday/_lib": typeof flexFriday__lib;
  "flexFriday/attendance": typeof flexFriday_attendance;
  "flexFriday/counts": typeof flexFriday_counts;
  "flexFriday/credits": typeof flexFriday_credits;
  "flexFriday/fridays": typeof flexFriday_fridays;
  "flexFriday/migrations": typeof flexFriday_migrations;
  "flexFriday/permissions": typeof flexFriday_permissions;
  "flexFriday/registration": typeof flexFriday_registration;
  "flexFriday/sessions": typeof flexFriday_sessions;
  "flexFriday/workshops": typeof flexFriday_workshops;
  http: typeof http;
  "moderation/feedbackAccess": typeof moderation_feedbackAccess;
  "moderation/keywords": typeof moderation_keywords;
  "moderation/reportValidation": typeof moderation_reportValidation;
  "moderation/reports": typeof moderation_reports;
  "notifications/_lib": typeof notifications__lib;
  "notifications/_pushActivation": typeof notifications__pushActivation;
  "notifications/_pushDevices": typeof notifications__pushDevices;
  "notifications/_pushOwnership": typeof notifications__pushOwnership;
  "notifications/_subscriptionPruning": typeof notifications__subscriptionPruning;
  "notifications/delivery": typeof notifications_delivery;
  "notifications/deliveryPreference": typeof notifications_deliveryPreference;
  "notifications/inbox": typeof notifications_inbox;
  "notifications/migrations": typeof notifications_migrations;
  "notifications/preferences": typeof notifications_preferences;
  "notifications/push": typeof notifications_push;
  "notifications/pushDevices": typeof notifications_pushDevices;
  "notifications/pushExpo": typeof notifications_pushExpo;
  "notifications/pushNode": typeof notifications_pushNode;
  rateLimits: typeof rateLimits;
  "schedule/_lib": typeof schedule__lib;
  "schedule/blocks": typeof schedule_blocks;
  "schedule/dashboard": typeof schedule_dashboard;
  "schedule/dayPlans": typeof schedule_dayPlans;
  "schedule/dayResolver": typeof schedule_dayResolver;
  "schedule/friends": typeof schedule_friends;
  "schedule/groupComparison": typeof schedule_groupComparison;
  "schedule/groupPolicy": typeof schedule_groupPolicy;
  "schedule/groups": typeof schedule_groups;
  "schedule/importOcr": typeof schedule_importOcr;
  "schedule/migrations": typeof schedule_migrations;
  "schedule/scheduleChangeNotifications": typeof schedule_scheduleChangeNotifications;
  "schedule/seed": typeof schedule_seed;
  "schedule/shareLinkSecurity": typeof schedule_shareLinkSecurity;
  "schedule/shareLinks": typeof schedule_shareLinks;
  "search/global": typeof search_global;
  seed: typeof seed;
  stats: typeof stats;
  "uploads/announcementImages": typeof uploads_announcementImages;
  "uploads/chatAttachments": typeof uploads_chatAttachments;
  "uploads/feedbackImages": typeof uploads_feedbackImages;
  "uploads/fileSignatures": typeof uploads_fileSignatures;
  "uploads/files": typeof uploads_files;
  "uploads/limits": typeof uploads_limits;
  "uploads/orphanCleanup": typeof uploads_orphanCleanup;
  "uploads/quota": typeof uploads_quota;
  "uploads/uploadIntents": typeof uploads_uploadIntents;
  "users/_lib": typeof users__lib;
  "users/admin": typeof users_admin;
  "users/auth": typeof users_auth;
  "users/dashboardLayout": typeof users_dashboardLayout;
  "users/impersonation": typeof users_impersonation;
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
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};

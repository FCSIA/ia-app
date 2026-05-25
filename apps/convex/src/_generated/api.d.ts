/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as announcements_comments from "../announcements/comments.js";
import type * as announcements_feed from "../announcements/feed.js";
import type * as announcements_lib from "../announcements/lib.js";
import type * as audit_events from "../audit/events.js";
import type * as audit_lib from "../audit/lib.js";
import type * as auth from "../auth.js";
import type * as courses_catalog from "../courses/catalog.js";
import type * as courses_lib from "../courses/lib.js";
import type * as courses_seed from "../courses/seed.js";
import type * as http from "../http.js";
import type * as lib_currentUser from "../lib/currentUser.js";
import type * as lib_roles from "../lib/roles.js";
import type * as notifications_inbox from "../notifications/inbox.js";
import type * as notifications_lib from "../notifications/lib.js";
import type * as notifications_preferences from "../notifications/preferences.js";
import type * as schedule_blocks from "../schedule/blocks.js";
import type * as schedule_dashboard from "../schedule/dashboard.js";
import type * as schedule_friends from "../schedule/friends.js";
import type * as schedule_lib from "../schedule/lib.js";
import type * as schedule_seed from "../schedule/seed.js";
import type * as users_admin from "../users/admin.js";
import type * as users_auth from "../users/auth.js";
import type * as users_lib from "../users/lib.js";
import type * as users_me from "../users/me.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "announcements/comments": typeof announcements_comments;
  "announcements/feed": typeof announcements_feed;
  "announcements/_lib": typeof announcements_lib;
  "audit/events": typeof audit_events;
  "audit/_lib": typeof audit_lib;
  auth: typeof auth;
  "courses/catalog": typeof courses_catalog;
  "courses/_lib": typeof courses_lib;
  "courses/seed": typeof courses_seed;
  http: typeof http;
  "lib/currentUser": typeof lib_currentUser;
  "lib/roles": typeof lib_roles;
  "notifications/inbox": typeof notifications_inbox;
  "notifications/_lib": typeof notifications_lib;
  "notifications/preferences": typeof notifications_preferences;
  "schedule/blocks": typeof schedule_blocks;
  "schedule/dashboard": typeof schedule_dashboard;
  "schedule/friends": typeof schedule_friends;
  "schedule/_lib": typeof schedule_lib;
  "schedule/seed": typeof schedule_seed;
  "users/admin": typeof users_admin;
  "users/auth": typeof users_auth;
  "users/_lib": typeof users_lib;
  "users/me": typeof users_me;
  validators: typeof validators;
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

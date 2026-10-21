/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import { searchText, toAdminUserProfile, toUserSelfProfile } from "./_lib";
import { toClubUserRef } from "../clubs/serialize";
import { serializeUser } from "../schedule/_lib";
import { channelNotificationAuthorName } from "../clubs/channelNotificationCopy";
import { displayName, greetingName, nameInitials, nameSearchValues } from "../../../shared/user-name";

// Use real current-user guards, substituting only Better Auth's identity lookup.
vi.mock("../auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth")>();
  return {
    ...original,
    authComponent: {
      ...original.authComponent,
      safeGetAuthUser: async (ctx: QueryCtx) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity ? { _id: identity.subject } : null;
      },
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const makeUser = (uniqueId: string, firstName: string, admin = false) => ctx.db.insert("users", {
      authUserId: uniqueId,
      uniqueId, firstName, lastName: "Johnson", gradeLevel: 10,
      roles: admin ? ["SUPER_ADMIN"] : ["STUDENT"],
      isStudent: !admin, isTeacherStaff: admin, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [],
      searchText: searchText({ uniqueId, firstName, lastName: "Johnson" }),
      createdAt: 1, updatedAt: 1,
    });
    const aliceId = await makeUser("NAME001", "Alice");
    const bobId = await makeUser("NAME002", "Bob");
    const adminId = await makeUser("NAMEADMIN", "Admin", true);
    const clubId = await ctx.db.insert("clubs", { name: "Name tests", joinPolicy: "OPEN", isActive: true, createdAt: 1, updatedAt: 1 });
    const inviteClubId = await ctx.db.insert("clubs", { name: "Invite tests", joinPolicy: "OPEN", isActive: true, createdAt: 1, updatedAt: 1 });
    for (const userId of [aliceId, bobId]) await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    const channelId = await ctx.db.insert("clubChannels", { clubId, name: "general", visibility: "PUBLIC", createdById: aliceId, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("clubChannelMessages", { channelId, authorId: aliceId, body: "Old message", isPinned: false, createdAt: 1, updatedAt: 1 });
    return { aliceId, bobId, adminId, clubId, inviteClubId, channelId };
  });
  return { t, ...ids, alice: t.withIdentity({ subject: "NAME001" }), bob: t.withIdentity({ subject: "NAME002" }), admin: t.withIdentity({ subject: "NAMEADMIN" }) };
}

describe("preferred profile names", () => {
  test("normalizes, persists only on the signed-in account, and restores the regular name when cleared", async () => {
    const { t, alice, aliceId, bobId } = await fixture();
    const saved = await alice.mutation(api.users.me.updatePreferredName, { preferredName: "  Ally   J.  " });
    expect(saved).toMatchObject({ firstName: "Alice", lastName: "Johnson", preferredName: "Ally J." });
    expect(displayName(await alice.query(api.users.me.me, {}))).toBe("Ally J.");
    const stored = await t.run(ctx => ctx.db.get(aliceId));
    expect(stored?.searchText).toContain("alice johnson");
    expect(stored?.searchText).toContain("ally j.");
    expect((await t.run(ctx => ctx.db.get(bobId)))?.preferredName).toBeUndefined();
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: " \n\t " });
    expect(displayName(await alice.query(api.users.me.me, {}))).toBe("Alice Johnson");
    expect((await t.run(ctx => ctx.db.get(aliceId)))?.searchText).not.toContain("ally");
  });

  test("rejects unauthenticated, inactive, reset-required, oversized, control-character, and impersonated writes", async () => {
    const { t, alice, aliceId, bobId } = await fixture();
    await expect(t.mutation(api.users.me.updatePreferredName, { preferredName: "Nope" })).rejects.toThrow("Unauthenticated");
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "A".repeat(81) })).rejects.toThrow("80 characters");
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "Al\u0000ly" })).rejects.toThrow("control characters");
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "Nope", userId: bobId } as never)).rejects.toThrow();
    await t.run(ctx => ctx.db.patch(aliceId, { isActive: false }));
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "Nope" })).rejects.toThrow("Unauthenticated");
    await t.run(ctx => ctx.db.patch(aliceId, { isActive: true, mustResetPassword: true }));
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "Nope" })).rejects.toThrow("Password reset required");
    expect((await t.run(ctx => ctx.db.get(aliceId)))?.preferredName).toBeUndefined();
  });

  test("finds both names through global, friend, admin, and invitation search; removes a replaced nickname", async () => {
    const { alice, bob, admin, inviteClubId } = await fixture();
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "Ally" });
    for (const query of ["Ally", "Alice Johnson"]) {
      expect((await bob.query(api.search.global.palette, { search: query })).people).toEqual(expect.arrayContaining([expect.objectContaining({ preferredName: "Ally", firstName: "Alice" })]));
      expect(await bob.query(api.schedule.friends.search, { query })).toEqual(expect.arrayContaining([expect.objectContaining({ preferredName: "Ally" })]));
      expect((await admin.query(api.users.admin.list, { search: query, paginationOpts: { cursor: null, numItems: 20 } })).page).toEqual(expect.arrayContaining([expect.objectContaining({ preferredName: "Ally" })]));
      expect(await admin.query(api.clubs.invitations.searchInviteCandidates, { clubId: inviteClubId, query })).toEqual(expect.arrayContaining([expect.objectContaining({ preferredName: "Ally" })]));
    }
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "Alicia" });
    expect((await bob.query(api.search.global.palette, { search: "Ally" })).people).toHaveLength(0);
    expect(await bob.query(api.schedule.friends.search, { query: "Alice" })).toHaveLength(1);
  });

  test("finds audit actors by regular full name, preferred name, or account ID", async () => {
    const { t, alice, admin, aliceId } = await fixture();
    await t.run(ctx => ctx.db.insert("auditEvents", {
      actorId: aliceId, action: "PROFILE_TEST", entityType: "User", createdAt: 1,
    }));
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "Ally Rivera" });
    for (const name of ["Alice Johnson", "Ally Rivera", "NAME001"]) {
      for (const filter of [{ actor: name }, { query: name }]) {
        const expected = expect.arrayContaining([expect.objectContaining({ actor: expect.objectContaining({ preferredName: "Ally Rivera" }) })]);
        expect(await admin.query(api.audit.events.list, filter)).toEqual(expected);
        expect((await admin.query(api.audit.events.listPage, { ...filter, paginationOpts: { numItems: 20, cursor: null } })).page).toEqual(expected);
      }
    }
  });

  test("shows the current name on existing messages and every shared user projection", async () => {
    const { t, alice, bob, aliceId, clubId, channelId } = await fixture();
    const read = () => bob.query(api.clubs.channels.getMessagePage, { clubId, channelId, paginationOpts: { cursor: null, numItems: 20 } });
    expect(displayName((await read()).page[0].author)).toBe("Alice Johnson");
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "Ally" });
    expect(displayName((await read()).page[0].author)).toBe("Ally");
    await t.run(async ctx => {
      const user = (await ctx.db.get(aliceId))!;
      for (const project of [toClubUserRef, serializeUser, toUserSelfProfile, toAdminUserProfile]) expect(displayName(project(user))).toBe("Ally");
      expect(channelNotificationAuthorName(user)).toBe("Ally");
    });
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "" });
    expect(displayName((await read()).page[0].author)).toBe("Alice Johnson");
  });

  test("masks profanity before storage/search and creates a reviewable report, audit, and notification", async () => {
    const { t, alice, bob, admin, aliceId } = await fixture();
    const saved = await alice.mutation(api.users.me.updatePreferredName, { preferredName: "  Shit   Smith  " });
    expect(saved).toMatchObject({ firstName: "Alice", lastName: "Johnson", preferredName: "*** Smith" });
    const stored = await t.run(ctx => ctx.db.get(aliceId));
    expect(stored?.searchText).not.toContain("shit");
    expect((await bob.query(api.search.global.palette, { search: "shit" })).people).toHaveLength(0);
    const reports = await admin.query(api.moderation.reports.list, { status: "PENDING" });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ contentType: "PREFERRED_NAME", contentId: aliceId, submitterId: aliceId, reportedUserId: aliceId, isEscalated: false });
    expect(reports[0].reason).toContain("Shit Smith");
    expect(reports[0].githubIssueSyncState).toBeUndefined();
    expect(await bob.query(api.moderation.reports.list, {})).toEqual([]);
    const audit = await t.run(ctx => ctx.db.query("auditEvents").withIndex("by_createdAt").take(10));
    expect(audit).toEqual([expect.objectContaining({ actorId: aliceId, action: "AUTO_MODERATION_FLAGGED", entityType: "Report", entityId: reports[0]._id })]);
    const notices = await alice.query(api.notifications.inbox.list, {});
    expect(notices).toEqual([expect.objectContaining({ category: "CONTENT_MODERATED", href: "/profile", title: "Preferred name filtered for language" })]);
    expect(notices[0].body).not.toContain("Shit");
    await expect(bob.mutation(api.moderation.reports.update, { reportId: reports[0]._id, status: "DISMISSED", reviewNote: "No" })).rejects.toThrow("Forbidden");
    await admin.mutation(api.moderation.reports.update, { reportId: reports[0]._id, status: "RESOLVED", reviewNote: "Reviewed" });
    expect(await admin.query(api.moderation.reports.list, { status: "PENDING" })).toEqual([]);
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "Ally" });
    expect((await admin.query(api.moderation.reports.list, { status: "RESOLVED" }))[0].reason).toContain("Shit Smith");
  });

  test("uses active school rules, skips removed rules, and preserves innocent substrings and Unicode names", async () => {
    const { t, alice, adminId } = await fixture();
    await t.run(async ctx => {
      for (const [keyword, isActive] of [["maple", true], ["river", false]] as const) {
        await ctx.db.insert("moderationKeywordRules", { keyword, isActive, addedById: adminId, createdAt: 1 });
      }
    });
    expect((await alice.mutation(api.users.me.updatePreferredName, { preferredName: "MAPLE King" })).preferredName).toBe("*** King");
    for (const name of ["Maplewood River", "Scunthorpe Cassidy", "Élodie 王", "𠮷野 太郎"]) {
      expect((await alice.mutation(api.users.me.updatePreferredName, { preferredName: name })).preferredName).toBe(name);
    }
  });

  test.each(["sh1t King", "ｓｈｉｔ King", "Shít King", "s h i t"]) (
    "does not publish or index detected obfuscated profanity: %s", async (name) => {
      const { t, alice, aliceId, admin } = await fixture();
      const saved = await alice.mutation(api.users.me.updatePreferredName, { preferredName: name });
      expect(saved.preferredName).not.toBe(name);
      expect(saved.preferredName).toMatch(/^\*+/);
      expect((await t.run(ctx => ctx.db.get(aliceId)))?.searchText).not.toContain(name.toLowerCase());
      expect(await admin.query(api.moderation.reports.list, { status: "PENDING" })).toHaveLength(1);
    },
  );

  test("limits report-generating name changes while always allowing a clear", async () => {
    const { alice, admin } = await fixture();
    for (let index = 0; index < 5; index++) {
      await alice.mutation(api.users.me.updatePreferredName, { preferredName: "shit " + index });
    }
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "shit again" })).rejects.toThrow("Too many name changes");
    expect(await admin.query(api.moderation.reports.list, {})).toHaveLength(5);
    expect((await alice.mutation(api.users.me.updatePreferredName, { preferredName: "" })).preferredName).toBeUndefined();
  });

  test("keeps the moderation report even when the author has disabled moderation notifications", async () => {
    const { t, alice, aliceId, admin } = await fixture();
    await t.run(ctx => ctx.db.insert("notificationPreferences", { userId: aliceId, category: "CONTENT_MODERATED", scopeKey: "global", enabled: false, level: "OFF", locked: false, createdAt: 1, updatedAt: 1 }));
    await alice.mutation(api.users.me.updatePreferredName, { preferredName: "shit" });
    expect(await alice.query(api.notifications.inbox.list, {})).toEqual([]);
    expect(await admin.query(api.moderation.reports.list, {})).toHaveLength(1);
  });

  test("refuses to save unchecked names when the active rule set exceeds the read bound", async () => {
    const { t, alice, aliceId, adminId } = await fixture();
    await t.run(async ctx => {
      for (let index = 0; index < 1_001; index++) {
        await ctx.db.insert("moderationKeywordRules", { keyword: "restricted" + index, isActive: true, addedById: adminId, createdAt: 1 });
      }
    });
    await expect(alice.mutation(api.users.me.updatePreferredName, { preferredName: "Ally" })).rejects.toThrow("Safety rules are temporarily unavailable");
    expect((await t.run(ctx => ctx.db.get(aliceId)))?.preferredName).toBeUndefined();
    expect((await alice.mutation(api.users.me.updatePreferredName, { preferredName: "" })).preferredName).toBeUndefined();
  });

  test("uses the same fallback for greetings, initials, Unicode names, and local search", () => {
    const person = { firstName: "Alice", lastName: "Johnson", preferredName: "Élodie 王" };
    expect(displayName(person)).toBe("Élodie 王");
    expect(greetingName(person)).toBe("Élodie 王");
    expect(nameInitials(person)).toBe("É王");
    expect(nameSearchValues(person)).toEqual(["Alice Johnson", "Élodie 王"]);
    expect(displayName({ ...person, preferredName: " " })).toBe("Alice Johnson");
    expect(greetingName({ ...person, preferredName: undefined })).toBe("Alice");
    expect(nameInitials({ preferredName: "𠮷野 太郎" })).toBe("𠮷太");
    expect(displayName(null)).toBe("");
  });
});

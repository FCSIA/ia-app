/// <reference types="vite/client" />

import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

// Real current-user guards, substituting only Better Auth's identity lookup.
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

afterEach(() => vi.useRealTimers());

const shape = (
  id: string,
  version: number,
  overrides: Record<string, unknown> = {},
) =>
  JSON.stringify({
    id,
    type: "rectangle",
    version,
    versionNonce: 10,
    isDeleted: false,
    x: version,
    ...overrides,
  });

async function seed(ctx: MutationCtx) {
  const now = 1;
  const makeUser = (uniqueId: string, roles: string[] = ["STUDENT"]) =>
    ctx.db.insert("users", {
      authUserId: uniqueId,
      uniqueId,
      firstName: uniqueId,
      lastName: "User",
      roles: roles as never,
      isStudent: roles.includes("STUDENT"),
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: `${uniqueId} User`,
      createdAt: now,
      updatedAt: now,
    });
  const memberId = await makeUser("MEMBER");
  const otherMemberId = await makeUser("OTHER");
  await makeUser("OUTSIDER");
  await makeUser("ADMIN", ["ADMIN"]);

  const clubId = await ctx.db.insert("clubs", {
    name: "Board Club",
    joinPolicy: "OPEN",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const memberRoleId = await ctx.db.insert("clubRoles", {
    clubId,
    name: "Member",
    permissions: NO_CLUB_PERMISSIONS,
    isDefault: true,
    showInDirectory: false,
    position: 0,
    createdById: memberId,
    createdAt: now,
    updatedAt: now,
  });
  for (const userId of [memberId, otherMemberId]) {
    await ctx.db.insert("clubMembers", {
      clubId,
      userId,
      roleId: memberRoleId,
      joinedAt: now,
    });
  }
  const makeChannel = (
    name: string,
    visibility: "PUBLIC" | "PRIVATE" | "MEMBER_READONLY",
    postingPolicy: "AUDIENCE" | "CLUB_MANAGERS" = "AUDIENCE",
  ) =>
    ctx.db.insert("clubChannels", {
      clubId,
      accessPolicyVersion: 2,
      accessRoleIds: [],
      postingPolicy,
      name,
      visibility,
      createdById: memberId,
      createdAt: now,
      updatedAt: now,
    });
  return {
    clubId,
    memberId,
    channelId: await makeChannel("General", "PUBLIC"),
    readOnlyChannelId: await makeChannel(
      "News",
      "MEMBER_READONLY",
      "CLUB_MANAGERS",
    ),
  };
}

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(seed);
  const as = {
    member: t.withIdentity({ subject: "MEMBER" }),
    other: t.withIdentity({ subject: "OTHER" }),
    outsider: t.withIdentity({ subject: "OUTSIDER" }),
    admin: t.withIdentity({ subject: "ADMIN" }),
  };
  return { t, as, ...ids };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

const whiteboards = api.clubs.whiteboards;

const save = (
  user: Fixture["as"]["member"],
  boardId: Id<"clubWhiteboards">,
  elements: string[],
) => user.mutation(whiteboards.saveElements, { boardId, elements });

const list = (
  user: Fixture["as"]["member"],
  channelId: Id<"clubChannels">,
  activeSince = 0,
) => user.query(whiteboards.listForChannel, { channelId, activeSince });

const changes = (
  user: Fixture["as"]["member"],
  boardId: Id<"clubWhiteboards">,
  afterSeq = 0,
) => user.query(whiteboards.listChanges, { boardId, afterSeq });

const snapshot = (
  user: Fixture["as"]["member"],
  boardId: Id<"clubWhiteboards">,
  atSeq: number,
) => user.query(whiteboards.getVersion, { boardId, atSeq });

async function clockOf(t: Fixture["t"], boardId: Id<"clubWhiteboards">) {
  return await t.run(async (ctx) => {
    const clock = await ctx.db
      .query("clubWhiteboardClocks")
      .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
      .unique();
    return { seq: clock!.seq, live: clock!.liveElementCount };
  });
}

async function countsOf(t: Fixture["t"], channelId: Id<"clubChannels">) {
  return await t.run(async (ctx) => {
    const row = await ctx.db
      .query("clubWhiteboardChannelCounts")
      .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
      .unique();
    return { active: row?.active ?? 0, archived: row?.archived ?? 0 };
  });
}

async function auditActions(
  t: Fixture["t"],
  entityType: string,
  entityId: string,
) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
          q.eq("entityType", entityType).eq("entityId", entityId),
        )
        .collect()
    ).map((row) => row.action),
  );
}

const texts = (result: { elements: string[] } | null) =>
  result!.elements.map((data) => {
    const parsed = JSON.parse(data);
    return parsed.text ?? parsed.id;
  });

describe("club channel whiteboards", () => {
  test("every channel reader can create and edit boards; outsiders cannot", async () => {
    const { t, as, channelId, readOnlyChannelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, {
      channelId,
      title: "  Robot   design  ",
    });
    const saved = await save(as.member, boardId, [shape("a", 1)]);
    // Read-only channels restrict chat posting, never whiteboards.
    const readOnlyBoard = await as.other.mutation(whiteboards.create, {
      channelId: readOnlyChannelId,
    });
    const readOnly = await save(as.other, readOnlyBoard, [shape("r", 1)]);
    const adminSave = await save(as.admin, boardId, [shape("b", 1)]);

    await expect(
      as.outsider.mutation(whiteboards.create, { channelId }),
    ).rejects.toThrow(/Not authorized/);
    await expect(save(as.outsider, boardId, [shape("c", 1)])).rejects.toThrow(
      /Not authorized/,
    );
    await expect(
      as.outsider.mutation(whiteboards.rename, { boardId, title: "Mine" }),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      as.outsider.mutation(whiteboards.setArchived, { boardId, archived: true }),
    ).rejects.toThrow(/Not authorized/);

    const titles = await t.run(async (ctx) => ({
      board: (await ctx.db.get(boardId))!.title,
      untitled: (await ctx.db.get(readOnlyBoard))!.title,
    }));
    expect(titles).toEqual({ board: "Robot design", untitled: "Untitled whiteboard" });
    expect([saved.accepted, readOnly.accepted, adminSave.accepted]).toEqual([1, 1, 1]);
    expect(await list(as.outsider, channelId)).toBeNull();
    expect(await changes(as.outsider, boardId)).toBeNull();
    expect((await changes(as.admin, boardId))?.changes).toHaveLength(2);
  });

  test("admins reach boards in private channels they are not members of", async () => {
    const { t, as, clubId, memberId } = await fixture();
    const privateChannelId = await t.run((ctx) =>
      ctx.db.insert("clubChannels", {
        clubId,
        accessPolicyVersion: 2,
        accessRoleIds: [],
        postingPolicy: "AUDIENCE",
        name: "Secret",
        visibility: "PRIVATE",
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const boardId = await as.admin.mutation(whiteboards.create, {
      channelId: privateChannelId,
    });
    expect((await save(as.admin, boardId, [shape("p", 1)])).accepted).toBe(1);
  });

  test("a rapid run of board changes is rate limited per person", async () => {
    const { as, channelId } = await fixture();
    for (let index = 0; index < 10; index += 1) {
      await as.member.mutation(whiteboards.create, { channelId });
    }
    await expect(
      as.member.mutation(whiteboards.create, { channelId }),
    ).rejects.toThrow(/Too many whiteboard changes/);
    await as.other.mutation(whiteboards.create, { channelId });
  });

  test("boards are independent, listed with activity, and archivable", async () => {
    vi.useFakeTimers();
    const { t, as, channelId } = await fixture();
    const first = await as.member.mutation(whiteboards.create, { channelId, title: "First" });
    const second = await as.member.mutation(whiteboards.create, { channelId, title: "Second" });
    await save(as.member, first, [shape("a", 1)]);
    await save(as.other, second, [shape("a", 1), shape("b", 1)]);
    await as.other.mutation(whiteboards.rename, { boardId: second, title: "Renamed" });
    await as.other.mutation(whiteboards.setArchived, { boardId: first, archived: true });
    await expect(save(as.member, first, [shape("a", 2)])).rejects.toThrow(/archived/);
    await as.member.mutation(whiteboards.setArchived, { boardId: first, archived: false });
    const afterUnarchive = await save(as.member, first, [shape("a", 2)]);
    const actions = await auditActions(t, "ClubWhiteboard", first);
    await as.member.mutation(whiteboards.setArchived, { boardId: first, archived: true });

    // Drawing reaches the list through one deferred activity refresh.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const listed = await list(as.member, channelId);

    expect(
      listed!.boards.map((board) => ({ title: board.title, updatedBy: board.updatedByName })),
    ).toEqual([{ title: "Renamed", updatedBy: "OTHER User" }]);
    expect(listed!.archivedCount).toBe(1);
    expect(await countsOf(t, channelId)).toEqual({ active: 1, archived: 1 });
    expect(afterUnarchive.accepted).toBe(1);
    expect(actions).toEqual([
      "CLUB_WHITEBOARD_CREATED",
      "CLUB_WHITEBOARD_EDITED",
      "CLUB_WHITEBOARD_ARCHIVED",
      "CLUB_WHITEBOARD_UNARCHIVED",
      // A new row: the earlier edit's row is no longer the newest entry.
      "CLUB_WHITEBOARD_EDITED",
    ]);
  });

  test("limits active boards exactly while archived boards are unlimited and paged", async () => {
    const { t, as, channelId, clubId, memberId } = await fixture();
    // 100 active boards and 180 archived ones, stored as the mutations would.
    const archivedIds = await t.run(async (ctx) => {
      const insertBoard = (title: string, isArchived: boolean) =>
        ctx.db.insert("clubWhiteboards", {
          clubId,
          channelId,
          title,
          createdById: memberId,
          createdAt: 1,
          updatedAt: 1,
          isArchived,
          ...(isArchived ? { archivedAt: 1 } : {}),
        });
      const ids: Id<"clubWhiteboards">[] = [];
      for (let index = 0; index < 180; index += 1) {
        ids.push(await insertBoard(`Archived ${index}`, true));
      }
      for (let index = 0; index < 100; index += 1) {
        await insertBoard(`Active ${index}`, false);
      }
      await ctx.db.insert("clubWhiteboardChannelCounts", {
        channelId,
        active: 100,
        archived: 180,
      });
      return ids;
    });

    await expect(
      as.member.mutation(whiteboards.create, { channelId }),
    ).rejects.toThrow(/100 active whiteboards/);
    await expect(
      as.member.mutation(whiteboards.setArchived, {
        boardId: archivedIds[0]!,
        archived: false,
      }),
    ).rejects.toThrow(/100 active whiteboards/);

    const listed = await list(as.member, channelId);
    expect(listed!.boards).toHaveLength(100);
    expect(listed!.boards.every((board) => board.archivedAt === null)).toBe(true);
    expect(listed!.archivedCount).toBe(180);

    // Every archived board is reachable by paging, and only archived boards.
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const page: {
        page: Array<{ _id: string; archivedAt: number | null }>;
        isDone: boolean;
        continueCursor: string;
      } = await as.member.query(whiteboards.listArchived, {
        channelId,
        paginationOpts: { numItems: 50, cursor },
      });
      for (const board of page.page) {
        expect(board.archivedAt).not.toBeNull();
        seen.add(board._id);
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(seen.size).toBe(180);
  });

  test("follows changes by sequence and resolves concurrent versions", async () => {
    const { t, as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, boardId, [shape("a", 1), shape("b", 1)]);
    const afterFirst = await changes(as.member, boardId);
    const stale = await save(as.other, boardId, [shape("a", 1, { versionNonce: 50 })]);
    const newer = await save(as.other, boardId, [shape("a", 2)]);
    const incremental = await changes(as.member, boardId, 2);
    await save(as.member, boardId, [shape("b", 2, { isDeleted: true })]);

    expect(afterFirst!.changes.map((change) => change.seq)).toEqual([1, 2]);
    expect(stale.accepted).toBe(0);
    expect(newer.accepted).toBe(1);
    expect(
      incremental!.changes.map((change) => ({
        seq: change.seq,
        version: JSON.parse(change.data).version,
      })),
    ).toEqual([{ seq: 3, version: 2 }]);
    expect(await clockOf(t, boardId)).toEqual({ seq: 4, live: 1 });
  });

  test("coalesces revisions and their audit rows per person, and rebuilds past states", async () => {
    const { t, as, channelId, memberId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, boardId, [shape("t", 1, { type: "text", text: "first draft" })]);
    await save(as.member, boardId, [shape("m", 1)]);
    await save(as.other, boardId, [
      shape("t", 2, { type: "text", text: "rewritten" }),
      shape("s", 1),
    ]);
    await save(as.member, boardId, [shape("s", 2, { isDeleted: true })]);

    const { audits, revisions } = await t.run(async (ctx) => ({
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
          q.eq("entityType", "ClubWhiteboard").eq("entityId", boardId),
        )
        .collect(),
      revisions: await ctx.db
        .query("clubWhiteboardRevisions")
        .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", boardId))
        .collect(),
    }));

    // The member's first two saves share one revision and one audit row.
    expect(audits.filter((row) => row.action === "CLUB_WHITEBOARD_EDITED")).toHaveLength(3);
    expect(
      audits.find((row) => row.action === "CLUB_WHITEBOARD_EDITED")?.meta,
    ).toMatchObject({
      fromSeq: 1,
      toSeq: 2,
      saveCount: 2,
      created: 2,
      changes: [
        { elementId: "t", change: "created", textPreview: "first draft" },
        { elementId: "m", change: "created" },
      ],
    });
    expect(audits.find((row) => row.actorId !== memberId && row.action === "CLUB_WHITEBOARD_EDITED")?.meta).toMatchObject({
      fromSeq: 3,
      toSeq: 4,
      changes: [
        { elementId: "t", type: "text", change: "updated", textPreview: "rewritten" },
        { elementId: "s", type: "rectangle", change: "created" },
      ],
    });
    expect(
      revisions.map((row) => ({
        actor: row.actorId === memberId ? "member" : "other",
        fromSeq: row.fromSeq,
        toSeq: row.toSeq,
        created: row.created,
        updated: row.updated,
        deleted: row.deleted,
      })),
    ).toEqual([
      { actor: "member", fromSeq: 1, toSeq: 2, created: 2, updated: 0, deleted: 0 },
      { actor: "other", fromSeq: 3, toSeq: 4, created: 1, updated: 1, deleted: 0 },
      { actor: "member", fromSeq: 5, toSeq: 5, created: 0, updated: 0, deleted: 1 },
    ]);
    expect(texts(await snapshot(as.member, boardId, 2))).toEqual(["first draft", "m"]);
    expect(texts(await snapshot(as.member, boardId, 4))).toEqual(["m", "rewritten", "s"]);
    expect(texts(await snapshot(as.member, boardId, 5))).toEqual(["m", "rewritten"]);
  });

  test("restoring a version rewrites the board forward and can itself be undone", async () => {
    const { t, as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, boardId, [
      shape("t", 1, { type: "text", text: "keep me" }),
      shape("gone", 1),
    ]);
    // seq 2 is the version to return to. Then someone vandalizes the board.
    await save(as.other, boardId, [
      shape("t", 2, { type: "text", text: "vandalized" }),
      shape("gone", 2, { isDeleted: true }),
      shape("new", 1),
    ]);
    const restore = (atSeq: number) =>
      as.member.mutation(whiteboards.restoreVersion, { boardId, atSeq });
    const restored = await restore(2);
    const seqAfterRestore = (await clockOf(t, boardId)).seq;
    const afterRestore = texts(await snapshot(as.member, boardId, seqAfterRestore));
    // Restoring the pre-restore version undoes the restore.
    await restore(5);
    const afterUndo = texts(
      await snapshot(as.member, boardId, (await clockOf(t, boardId)).seq),
    );
    const revisions = await t.run((ctx) =>
      ctx.db
        .query("clubWhiteboardRevisions")
        .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", boardId))
        .collect(),
    );
    const actions = await auditActions(t, "ClubWhiteboard", boardId);

    expect(restored.changed).toBe(3);
    expect(seqAfterRestore).toBe(8);
    expect([...afterRestore].sort()).toEqual(["gone", "keep me"]);
    expect([...afterUndo].sort()).toEqual(["new", "vandalized"]);
    expect((await clockOf(t, boardId)).live).toBe(2);
    expect(
      revisions.filter((row) => row.kind === "RESTORE").map((row) => row.restoredToSeq),
    ).toEqual([2, 5]);
    expect(actions.filter((action) => action === "CLUB_WHITEBOARD_RESTORED")).toHaveLength(2);
    await expect(restore(999)).rejects.toThrow(/does not exist/);
  });

  test("channel deletion clears every board's live state but keeps reviewable history", async () => {
    vi.useFakeTimers();
    const { t, as, channelId } = await fixture();
    const activeId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, activeId, [shape("a", 1), shape("b", 1)]);
    const archivedId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, archivedId, [shape("c", 1)]);
    await as.member.mutation(whiteboards.setArchived, { boardId: archivedId, archived: true });
    await t.run((ctx) => ctx.db.delete(channelId));

    await t.mutation(internal.clubs.whiteboards.cleanupChannelWhiteboard, { channelId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const stored = await t.run(async (ctx) => ({
      remaining: await Promise.all(
        [activeId, archivedId].map(
          async (boardId) =>
            (
              await ctx.db
                .query("clubWhiteboardElements")
                .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId))
                .collect()
            ).length,
        ),
      ),
      archived: await Promise.all(
        [activeId, archivedId].map(async (boardId) => (await ctx.db.get(boardId))?.isArchived),
      ),
    }));
    const review = await as.admin.query(whiteboards.getAuditSnapshot, {
      boardId: activeId,
      atSeq: 2,
    });
    expect(stored).toEqual({ remaining: [0, 0], archived: [true, true] });
    expect((await clockOf(t, activeId)).live).toBe(0);
    expect((await clockOf(t, archivedId)).live).toBe(0);
    expect(await countsOf(t, channelId)).toEqual({ active: 0, archived: 2 });
    expect(review?.elements).toHaveLength(2);
    expect(review?.channelName).toBeNull();
  });

  test("channel managers can turn whiteboards off per channel without losing boards", async () => {
    const { t, as, channelId, readOnlyChannelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId, title: "Kept" });
    await save(as.member, boardId, [shape("a", 1)]);
    const otherBoardId = await as.member.mutation(whiteboards.create, {
      channelId: readOnlyChannelId,
    });
    const setEnabled = (user: Fixture["as"]["member"], enabled: boolean) =>
      user.mutation(whiteboards.setEnabledForChannel, { channelId, enabled });

    // A member without the edit-channels permission cannot change it.
    await expect(setEnabled(as.member, false)).rejects.toThrow(/permission/);
    // The admin holds the edit-channels permission.
    await setEnabled(as.admin, false);

    expect((await t.run((ctx) => ctx.db.get(channelId)))!.whiteboardsEnabled).toBe(false);
    expect(await list(as.member, channelId)).toBeNull();
    expect(await changes(as.member, boardId)).toBeNull();
    await expect(
      as.member.mutation(whiteboards.create, { channelId }),
    ).rejects.toThrow(/turned off/);
    await expect(save(as.member, boardId, [shape("b", 1)])).rejects.toThrow(/turned off/);
    await expect(save(as.admin, boardId, [shape("b", 1)])).rejects.toThrow(/turned off/);
    // Other channels are unaffected.
    expect((await save(as.member, otherBoardId, [shape("o", 1)])).accepted).toBe(1);
    // Staff audit review does not depend on the channel setting.
    expect(
      (await as.admin.query(whiteboards.getAuditSnapshot, { boardId, atSeq: 1 }))?.elements,
    ).toHaveLength(1);

    await setEnabled(as.admin, true);
    expect((await list(as.member, channelId))?.boards.map((board) => board.title)).toEqual([
      "Kept",
    ]);
    expect((await save(as.member, boardId, [shape("b", 1)])).accepted).toBe(1);
    expect(await auditActions(t, "ClubChannel", channelId)).toEqual([
      "CLUB_CHANNEL_WHITEBOARDS_DISABLED",
      "CLUB_CHANNEL_WHITEBOARDS_ENABLED",
    ]);
  });

  test("reports elements it cannot store without failing the rest of the save", async () => {
    const { t, as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    const saved = await save(as.member, boardId, [
      shape("ok", 1),
      shape("img", 1, { type: "image" }),
    ]);
    expect(saved.accepted).toBe(1);
    expect(saved.rejected).toEqual([
      { elementId: "img", kind: "invalid", reason: expect.stringMatching(/not supported/) },
    ]);
    expect(await clockOf(t, boardId)).toEqual({ seq: 1, live: 1 });
  });

  test("a full board applies removals first and reports what did not fit", async () => {
    const { t, as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, boardId, [shape("old", 1)]);
    // Pretend the board already holds the maximum number of live shapes.
    await t.run(async (ctx) => {
      const clock = await ctx.db
        .query("clubWhiteboardClocks")
        .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
        .unique();
      await ctx.db.patch(clock!._id, { liveElementCount: 5_000 });
    });
    const saved = await save(as.member, boardId, [
      shape("first", 1),
      shape("second", 1),
      shape("old", 2, { isDeleted: true }),
    ]);
    expect(saved.accepted).toBe(2);
    expect(saved.rejected).toEqual([
      { elementId: "second", kind: "full", reason: "This whiteboard is full" },
    ]);
    expect((await clockOf(t, boardId)).live).toBe(5_000);
  });

  test("never stores shapes that were erased before they were first saved", async () => {
    const { as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    const saved = await save(
      as.member,
      boardId,
      Array.from({ length: 50 }, (_, index) => shape(`ghost${index}`, 2, { isDeleted: true })),
    );
    expect(saved).toMatchObject({ accepted: 0, ignored: 50, rejected: [] });
    expect((await changes(as.member, boardId))!.changes).toHaveLength(0);
  });

  test("prunes day-old erased elements while restores still bring them back", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { t, as, channelId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    await save(as.member, boardId, [shape("kept", 1), shape("erased", 1)]);
    await save(as.member, boardId, [shape("erased", 4, { isDeleted: true })]);
    vi.setSystemTime(1_000_000 + 25 * 60 * 60 * 1000);
    await t.mutation(internal.clubs.whiteboards.pruneErasedWhiteboardElements, {});

    const rowsAfterPrune = (await changes(as.member, boardId))!.changes.map(
      (change) => JSON.parse(change.data).id,
    );
    await as.member.mutation(whiteboards.restoreVersion, { boardId, atSeq: 2 });
    const restored = (await changes(as.member, boardId))!.changes.map((change) =>
      JSON.parse(change.data),
    );

    expect(rowsAfterPrune).toEqual(["kept"]);
    // Above the erased version any stale client may still hold.
    expect(
      restored.map((element) => ({
        id: element.id,
        deleted: element.isDeleted,
        version: element.version,
      })),
    ).toContainEqual({ id: "erased", deleted: false, version: 5 });
  });

  test("restores recent versions of boards with long histories", async () => {
    const { t, as, channelId, memberId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    // Twelve thousand earlier writes to one shape, more than a restore could
    // ever walk.
    await t.run(async (ctx) => {
      for (let version = 1; version <= 12_000; version += 1) {
        await ctx.db.insert("clubWhiteboardHistory", {
          boardId,
          seq: version,
          elementId: "busy",
          isDeleted: false,
          data: shape("busy", version),
          actorId: memberId,
          createdAt: 1,
        });
      }
      await ctx.db.insert("clubWhiteboardElements", {
        boardId,
        elementId: "busy",
        seq: 12_000,
        version: 12_000,
        versionNonce: 10,
        isDeleted: false,
        data: shape("busy", 12_000),
        updatedById: memberId,
        updatedAt: 1,
      });
      const clock = await ctx.db
        .query("clubWhiteboardClocks")
        .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
        .unique();
      await ctx.db.patch(clock!._id, { seq: 12_000, liveElementCount: 1 });
    });
    await save(as.member, boardId, [shape("note", 1, { type: "text", text: "keep" })]);
    await save(as.other, boardId, [shape("note", 2, { type: "text", text: "oops" })]);

    const preview = await snapshot(as.member, boardId, 12_001);
    const restored = await as.member.mutation(whiteboards.restoreVersion, {
      boardId,
      atSeq: 12_001,
    });
    const now = texts(await snapshot(as.member, boardId, (await clockOf(t, boardId)).seq));

    expect({ texts: texts(preview), truncated: preview!.truncated }).toEqual({
      texts: ["busy", "keep"],
      truncated: false,
    });
    expect(restored.changed).toBe(1);
    expect([...now].sort()).toEqual(["busy", "keep"]);
  });

  test("duplicates every live element on the server in batches", async () => {
    vi.useFakeTimers();
    const { t, as, channelId } = await fixture();
    const sourceId = await as.member.mutation(whiteboards.create, {
      channelId,
      title: "Source",
    });
    for (let start = 0; start < 250; start += 125) {
      await save(
        as.member,
        sourceId,
        Array.from({ length: 125 }, (_, index) => shape(`e${start + index}`, 1)),
      );
    }
    await save(as.member, sourceId, [shape("e0", 2, { isDeleted: true })]);
    const copyId = await as.other.mutation(whiteboards.create, {
      channelId,
      title: "Source (copy)",
      duplicatedFromBoardId: sourceId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await clockOf(t, sourceId)).live).toBe(249);
    expect(await clockOf(t, copyId)).toEqual({ seq: 249, live: 249 });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("clubWhiteboardElements")
          .withIndex("by_boardId_and_elementId", (q) =>
            q.eq("boardId", copyId).eq("elementId", "e0"),
          )
          .unique(),
      ),
    ).toBeNull();
  });

  test("counts people on a board from presence, not pointer movement", async () => {
    const { t, as, channelId, memberId } = await fixture();
    const boardId = await as.member.mutation(whiteboards.create, { channelId });
    const otherId = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", "OTHER"))
        .unique();
      return user!._id;
    });
    const count = async () =>
      (await list(as.member, channelId, 100))!.boards[0]!.activeViewerCount;
    await t.run((ctx) =>
      ctx.db.insert("clubWhiteboardCursors", {
        boardId,
        userId: otherId,
        x: 1,
        y: 1,
        button: "up",
        updatedAt: 200,
      }),
    );
    const cursorOnly = await count();
    await t.run(async (ctx) => {
      await ctx.db.insert("clubWhiteboardPresence", {
        boardId,
        userId: otherId,
        lastSeenAt: 150,
      });
      await ctx.db.insert("clubWhiteboardPresence", {
        boardId,
        userId: memberId,
        lastSeenAt: 50,
      });
    });
    expect({ cursorOnly, present: await count() }).toEqual({ cursorOnly: 0, present: 1 });
  });
});

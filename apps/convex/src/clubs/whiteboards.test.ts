/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import schema from "../schema";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";
import {
  createWhiteboard,
  getWhiteboardCounts,
  getWhiteboardSnapshot,
  listArchivedWhiteboards,
  listChannelWhiteboards,
  listWhiteboardChanges,
  renameWhiteboard,
  restoreWhiteboardVersion,
  saveWhiteboardElements,
  setWhiteboardArchived,
} from "./whiteboards";

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
  const outsiderId = await makeUser("OUTSIDER");
  const adminId = await makeUser("ADMIN", ["ADMIN"]);

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
  const channelId = await makeChannel("General", "PUBLIC");
  const readOnlyChannelId = await makeChannel(
    "News",
    "MEMBER_READONLY",
    "CLUB_MANAGERS",
  );
  const users = async (id: Id<"users">) => (await ctx.db.get(id))!;
  return {
    clubId,
    channelId,
    readOnlyChannelId,
    member: await users(memberId),
    otherMember: await users(otherMemberId),
    outsider: await users(outsiderId),
    admin: await users(adminId),
  };
}

const texts = (snapshot: { elements: string[] } | null) =>
  snapshot!.elements.map((data) => {
    const parsed = JSON.parse(data);
    return parsed.text ?? parsed.id;
  });

describe("club channel whiteboards", () => {
  test("every channel reader can create and edit boards; outsiders cannot", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId, {
        title: "  Robot   design  ",
      });
      const saved = await saveWhiteboardElements(ctx, s.member, boardId, [shape("a", 1)]);
      // Read-only channels restrict chat posting, never whiteboards.
      const readOnlyBoard = await createWhiteboard(ctx, s.otherMember, s.readOnlyChannelId);
      const readOnly = await saveWhiteboardElements(ctx, s.otherMember, readOnlyBoard, [
        shape("r", 1),
      ]);
      const adminSave = await saveWhiteboardElements(ctx, s.admin, boardId, [shape("b", 1)]);
      const errors: string[] = [];
      for (const attempt of [
        () => createWhiteboard(ctx, s.outsider, s.channelId),
        () => saveWhiteboardElements(ctx, s.outsider, boardId, [shape("c", 1)]),
        () => renameWhiteboard(ctx, s.outsider, boardId, "Mine"),
        () => setWhiteboardArchived(ctx, s.outsider, boardId, true),
      ]) {
        try {
          await attempt();
        } catch (error) {
          errors.push(String(error));
        }
      }
      return {
        title: (await ctx.db.get(boardId))!.title,
        untitled: (await ctx.db.get(readOnlyBoard))!.title,
        saved: saved.accepted,
        readOnly: readOnly.accepted,
        admin: adminSave.accepted,
        errors,
        outsiderList: await listChannelWhiteboards(ctx, s.outsider, s.channelId, 0),
        outsiderChanges: await listWhiteboardChanges(ctx, s.outsider, boardId, 0),
        adminChanges: (await listWhiteboardChanges(ctx, s.admin, boardId, 0))?.changes.length,
      };
    });

    expect(result.title).toBe("Robot design");
    expect(result.untitled).toBe("Untitled whiteboard");
    expect([result.saved, result.readOnly, result.admin]).toEqual([1, 1, 1]);
    expect(result.errors).toHaveLength(4);
    for (const error of result.errors) expect(error).toMatch(/Not authorized/);
    expect(result.outsiderList).toBeNull();
    expect(result.outsiderChanges).toBeNull();
    expect(result.adminChanges).toBe(2);
  });

  test("admins reach boards in private channels they are not members of", async () => {
    const t = convexTest(schema, modules);
    const accepted = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const privateChannelId = await ctx.db.insert("clubChannels", {
        clubId: s.clubId,
        accessPolicyVersion: 2,
        accessRoleIds: [],
        postingPolicy: "AUDIENCE",
        name: "Secret",
        visibility: "PRIVATE",
        createdById: s.member._id,
        createdAt: 1,
        updatedAt: 1,
      });
      const boardId = await createWhiteboard(ctx, s.admin, privateChannelId);
      return (await saveWhiteboardElements(ctx, s.admin, boardId, [shape("p", 1)])).accepted;
    });
    expect(accepted).toBe(1);
  });

  test("boards are independent, listed with activity, and archivable", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const first = await createWhiteboard(ctx, s.member, s.channelId, { title: "First" });
      const second = await createWhiteboard(ctx, s.member, s.channelId, { title: "Second" });
      await saveWhiteboardElements(ctx, s.member, first, [shape("a", 1)]);
      await saveWhiteboardElements(ctx, s.otherMember, second, [shape("a", 1), shape("b", 1)]);
      await renameWhiteboard(ctx, s.otherMember, second, "Renamed");
      await setWhiteboardArchived(ctx, s.otherMember, first, true);
      let archivedError = "";
      try {
        await saveWhiteboardElements(ctx, s.member, first, [shape("a", 2)]);
      } catch (error) {
        archivedError = String(error);
      }
      const list = await listChannelWhiteboards(ctx, s.member, s.channelId, 0);
      await setWhiteboardArchived(ctx, s.member, first, false);
      const afterUnarchive = await saveWhiteboardElements(ctx, s.member, first, [shape("a", 2)]);
      const actions = (
        await ctx.db
          .query("auditEvents")
          .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
            q.eq("entityType", "ClubWhiteboard").eq("entityId", first),
          )
          .collect()
      ).map((row) => row.action);
      return {
        list: list!.boards.map((board) => ({
          title: board.title,
          elements: board.elementCount,
          updatedBy: board.updatedByName,
        })),
        archivedCount: list!.archivedCount,
        counts: await getWhiteboardCounts(ctx, s.channelId),
        archivedError,
        afterUnarchive: afterUnarchive.accepted,
        actions,
      };
    });

    expect(result.list).toEqual([{ title: "Renamed", elements: 2, updatedBy: "OTHER User" }]);
    expect(result.archivedCount).toBe(1);
    expect(result.counts).toEqual({ active: 2, archived: 0 });
    expect(result.archivedError).toMatch(/archived/);
    expect(result.afterUnarchive).toBe(1);
    expect(result.actions).toEqual([
      "CLUB_WHITEBOARD_CREATED",
      "CLUB_WHITEBOARD_EDITED",
      "CLUB_WHITEBOARD_ARCHIVED",
      "CLUB_WHITEBOARD_UNARCHIVED",
      "CLUB_WHITEBOARD_EDITED",
    ]);
  });

  test("limits active boards exactly while archived boards are unlimited and paged", async () => {
    const t = convexTest(schema, modules);
    const { channelId, memberId, firstArchived } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      // Fill the channel, archive a batch, and refill: the archive can grow
      // past the active limit without affecting it.
      const archivedIds = [];
      for (let round = 0; round < 3; round += 1) {
        const ids = [];
        for (let index = 0; index < 60; index += 1) {
          ids.push(
            await createWhiteboard(ctx, s.member, s.channelId, { title: `R${round}-${index}` }),
          );
        }
        for (const id of ids) {
          await setWhiteboardArchived(ctx, s.member, id, true);
          archivedIds.push(id);
        }
      }
      for (let index = 0; index < 100; index += 1) {
        await createWhiteboard(ctx, s.member, s.channelId, { title: `Active ${index}` });
      }
      return { channelId: s.channelId, memberId: s.member._id, firstArchived: archivedIds[0]! };
    });

    const result = await t.run(async (ctx) => {
      const member = (await ctx.db.get(memberId))!;
      const errors: string[] = [];
      for (const attempt of [
        () => createWhiteboard(ctx, member, channelId),
        () => setWhiteboardArchived(ctx, member, firstArchived, false),
      ]) {
        try {
          await attempt();
        } catch (error) {
          errors.push(String(error));
        }
      }
      const list = await listChannelWhiteboards(ctx, member, channelId, 0);
      return { errors, list, counts: await getWhiteboardCounts(ctx, channelId) };
    });
    expect(result.errors).toHaveLength(2);
    for (const error of result.errors) expect(error).toMatch(/100 active whiteboards/);
    expect(result.counts).toEqual({ active: 100, archived: 180 });
    expect(result.list!.boards).toHaveLength(100);
    expect(result.list!.boards.every((board) => board.archivedAt === null)).toBe(true);
    expect(result.list!.archivedCount).toBe(180);

    // Every archived board is reachable by paging, and only archived boards.
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (;;) {
      const page: { page: Array<{ _id: string; archivedAt: number | null }>; isDone: boolean; continueCursor: string } =
        await t.run(async (ctx) =>
          listArchivedWhiteboards(ctx, (await ctx.db.get(memberId))!, channelId, {
            numItems: 50,
            cursor,
          }),
        );
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
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("a", 1), shape("b", 1)]);
      const afterFirst = await listWhiteboardChanges(ctx, s.member, boardId, 0);
      const stale = await saveWhiteboardElements(ctx, s.otherMember, boardId, [
        shape("a", 1, { versionNonce: 50 }),
      ]);
      const newer = await saveWhiteboardElements(ctx, s.otherMember, boardId, [shape("a", 2)]);
      const incremental = await listWhiteboardChanges(ctx, s.member, boardId, 2);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("b", 2, { isDeleted: true })]);
      const board = await ctx.db.get(boardId);
      return {
        afterFirst: afterFirst!.changes.map((change) => change.seq),
        stale: stale.accepted,
        newer: newer.accepted,
        incremental: incremental!.changes.map((change) => ({
          seq: change.seq,
          version: JSON.parse(change.data).version,
        })),
        board: { seq: board!.seq, live: board!.liveElementCount },
      };
    });

    expect(result.afterFirst).toEqual([1, 2]);
    expect(result.stale).toBe(0);
    expect(result.newer).toBe(1);
    expect(result.incremental).toEqual([{ seq: 3, version: 2 }]);
    expect(result.board).toEqual({ seq: 4, live: 1 });
  });

  test("audits every save, coalesces revisions per person, and rebuilds past states", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, boardId, [
        shape("t", 1, { type: "text", text: "first draft" }),
      ]);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("m", 1)]);
      await saveWhiteboardElements(ctx, s.otherMember, boardId, [
        shape("t", 2, { type: "text", text: "rewritten" }),
        shape("s", 1),
      ]);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("s", 2, { isDeleted: true })]);

      const audits = await ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
          q.eq("entityType", "ClubWhiteboard").eq("entityId", boardId),
        )
        .collect();
      const revisions = await ctx.db
        .query("clubWhiteboardRevisions")
        .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", boardId))
        .collect();
      return {
        edits: audits.filter((row) => row.action === "CLUB_WHITEBOARD_EDITED").length,
        otherAudit: audits.find((row) => row.actorId === s.otherMember._id)?.meta,
        revisions: revisions.map((row) => ({
          actor: row.actorId === s.member._id ? "member" : "other",
          fromSeq: row.fromSeq,
          toSeq: row.toSeq,
          created: row.created,
          updated: row.updated,
          deleted: row.deleted,
        })),
        atTwo: texts(await getWhiteboardSnapshot(ctx, boardId, 2)),
        atFour: texts(await getWhiteboardSnapshot(ctx, boardId, 4)),
        latest: texts(await getWhiteboardSnapshot(ctx, boardId, 5)),
      };
    });

    expect(result.edits).toBe(4);
    expect(result.otherAudit).toMatchObject({
      fromSeq: 3,
      toSeq: 4,
      changes: [
        { elementId: "t", type: "text", change: "updated", textPreview: "rewritten" },
        { elementId: "s", type: "rectangle", change: "created" },
      ],
    });
    expect(result.revisions).toEqual([
      { actor: "member", fromSeq: 1, toSeq: 2, created: 2, updated: 0, deleted: 0 },
      { actor: "other", fromSeq: 3, toSeq: 4, created: 1, updated: 1, deleted: 0 },
      { actor: "member", fromSeq: 5, toSeq: 5, created: 0, updated: 0, deleted: 1 },
    ]);
    expect(result.atTwo).toEqual(["first draft", "m"]);
    expect(result.atFour).toEqual(["m", "rewritten", "s"]);
    expect(result.latest).toEqual(["m", "rewritten"]);
  });

  test("restoring a version rewrites the board forward and can itself be undone", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, boardId, [
        shape("t", 1, { type: "text", text: "keep me" }),
        shape("gone", 1),
      ]);
      // seq 2 is the version to return to. Then someone vandalizes the board.
      await saveWhiteboardElements(ctx, s.otherMember, boardId, [
        shape("t", 2, { type: "text", text: "vandalized" }),
        shape("gone", 2, { isDeleted: true }),
        shape("new", 1),
      ]);
      const restored = await restoreWhiteboardVersion(ctx, s.member, boardId, 2);
      const seqAfterRestore = (await ctx.db.get(boardId))!.seq;
      const afterRestore = texts(await getWhiteboardSnapshot(ctx, boardId, seqAfterRestore));
      // Restoring the pre-restore version undoes the restore.
      await restoreWhiteboardVersion(ctx, s.member, boardId, 5);
      const afterUndo = texts(
        await getWhiteboardSnapshot(ctx, boardId, (await ctx.db.get(boardId))!.seq),
      );
      const revisions = await ctx.db
        .query("clubWhiteboardRevisions")
        .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", boardId))
        .collect();
      const audits = await ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
          q.eq("entityType", "ClubWhiteboard").eq("entityId", boardId),
        )
        .collect();
      let badSeq = "";
      try {
        await restoreWhiteboardVersion(ctx, s.member, boardId, 999);
      } catch (error) {
        badSeq = String(error);
      }
      return {
        changed: restored.changed,
        seqAfterRestore,
        afterRestore,
        afterUndo,
        live: (await ctx.db.get(boardId))!.liveElementCount,
        restoreRevisions: revisions
          .filter((row) => row.kind === "RESTORE")
          .map((row) => row.restoredToSeq),
        restoreAudits: audits.filter((row) => row.action === "CLUB_WHITEBOARD_RESTORED").length,
        badSeq,
      };
    });

    expect(result.changed).toBe(3);
    expect(result.seqAfterRestore).toBe(8);
    expect([...result.afterRestore].sort()).toEqual(["gone", "keep me"]);
    expect([...result.afterUndo].sort()).toEqual(["new", "vandalized"]);
    expect(result.live).toBe(2);
    expect(result.restoreRevisions).toEqual([2, 5]);
    expect(result.restoreAudits).toBe(2);
    expect(result.badSeq).toMatch(/does not exist/);
  });

  test("channel deletion clears every board's live state but keeps reviewable history", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { activeId, archivedId, channelId } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const activeId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, activeId, [shape("a", 1), shape("b", 1)]);
      const archivedId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, archivedId, [shape("c", 1)]);
      await setWhiteboardArchived(ctx, s.member, archivedId, true);
      await ctx.db.delete(s.channelId);
      return { activeId, archivedId, channelId: s.channelId };
    });
    await t.mutation(internal.clubs.whiteboards.cleanupChannelWhiteboard, { channelId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const result = await t.run(async (ctx) => {
      const remaining = await Promise.all(
        [activeId, archivedId].map((boardId) =>
          ctx.db
            .query("clubWhiteboardElements")
            .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId))
            .collect(),
        ),
      );
      const boards = await Promise.all([ctx.db.get(activeId), ctx.db.get(archivedId)]);
      const snapshot = await getWhiteboardSnapshot(ctx, activeId, 2);
      return {
        remaining: remaining.map((rows) => rows.length),
        boards: boards.map((board) => ({
          archived: board?.isArchived,
          live: board?.liveElementCount,
        })),
        counts: await getWhiteboardCounts(ctx, channelId),
        snapshotCount: snapshot?.elements.length,
        channelName: snapshot?.channelName,
      };
    });
    expect(result).toEqual({
      remaining: [0, 0],
      boards: [
        { archived: true, live: 0 },
        { archived: true, live: 0 },
      ],
      counts: { active: 0, archived: 2 },
      snapshotCount: 2,
      channelName: null,
    });
  });

  test("rejects unsupported elements without partial writes", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      let error = "";
      try {
        await saveWhiteboardElements(ctx, s.member, boardId, [
          shape("ok", 1),
          shape("img", 1, { type: "image" }),
        ]);
      } catch (caught) {
        error = String(caught);
      }
      return { error, board: await ctx.db.get(boardId) };
    });
    expect(result.error).toMatch(/not supported/);
    expect(result.board?.seq).toBe(0);
  });
});


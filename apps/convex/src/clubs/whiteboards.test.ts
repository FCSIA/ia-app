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
  setChannelWhiteboardsEnabled,
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

async function clockOf(ctx: MutationCtx, boardId: Id<"clubWhiteboards">) {
  const clock = await ctx.db
    .query("clubWhiteboardClocks")
    .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
    .unique();
  return { seq: clock!.seq, live: clock!.liveElementCount };
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
    vi.useFakeTimers();
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
      await setWhiteboardArchived(ctx, s.member, first, true);
      return {
        memberId: s.member._id,
        channelId: s.channelId,
        counts: await getWhiteboardCounts(ctx, s.channelId),
        archivedError,
        afterUnarchive: afterUnarchive.accepted,
        actions,
      };
    });
    // Drawing reaches the list through one deferred activity refresh.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const list = await t.run(async (ctx) =>
      listChannelWhiteboards(ctx, (await ctx.db.get(result.memberId))!, result.channelId, 0),
    );

    expect(
      list!.boards.map((board) => ({ title: board.title, updatedBy: board.updatedByName })),
    ).toEqual([{ title: "Renamed", updatedBy: "OTHER User" }]);
    expect(list!.archivedCount).toBe(1);
    expect(result.counts).toEqual({ active: 1, archived: 1 });
    expect(result.archivedError).toMatch(/archived/);
    expect(result.afterUnarchive).toBe(1);
    expect(result.actions).toEqual([
      "CLUB_WHITEBOARD_CREATED",
      "CLUB_WHITEBOARD_EDITED",
      "CLUB_WHITEBOARD_ARCHIVED",
      "CLUB_WHITEBOARD_UNARCHIVED",
      // A new row: the earlier edit's row is no longer the newest entry.
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
      return {
        afterFirst: afterFirst!.changes.map((change) => change.seq),
        stale: stale.accepted,
        newer: newer.accepted,
        incremental: incremental!.changes.map((change) => ({
          seq: change.seq,
          version: JSON.parse(change.data).version,
        })),
        board: await clockOf(ctx, boardId),
      };
    });

    expect(result.afterFirst).toEqual([1, 2]);
    expect(result.stale).toBe(0);
    expect(result.newer).toBe(1);
    expect(result.incremental).toEqual([{ seq: 3, version: 2 }]);
    expect(result.board).toEqual({ seq: 4, live: 1 });
  });

  test("coalesces revisions and their audit rows per person, and rebuilds past states", async () => {
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
        firstAudit: audits.find((row) => row.action === "CLUB_WHITEBOARD_EDITED")?.meta,
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

    // The member's first two saves share one revision and one audit row.
    expect(result.edits).toBe(3);
    expect(result.firstAudit).toMatchObject({
      fromSeq: 1,
      toSeq: 2,
      saveCount: 2,
      created: 2,
      changes: [
        { elementId: "t", change: "created", textPreview: "first draft" },
        { elementId: "m", change: "created" },
      ],
    });
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
      const seqAfterRestore = (await clockOf(ctx, boardId)).seq;
      const afterRestore = texts(await getWhiteboardSnapshot(ctx, boardId, seqAfterRestore));
      // Restoring the pre-restore version undoes the restore.
      await restoreWhiteboardVersion(ctx, s.member, boardId, 5);
      const afterUndo = texts(
        await getWhiteboardSnapshot(ctx, boardId, (await clockOf(ctx, boardId)).seq),
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
        live: (await clockOf(ctx, boardId)).live,
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
      const boards = await Promise.all(
        [activeId, archivedId].map(async (boardId) => ({
          archived: (await ctx.db.get(boardId))?.isArchived,
          live: (await clockOf(ctx, boardId)).live,
        })),
      );
      const snapshot = await getWhiteboardSnapshot(ctx, activeId, 2);
      return {
        remaining: remaining.map((rows) => rows.length),
        boards,
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

  test("channel managers can turn whiteboards off per channel without losing boards", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId, { title: "Kept" });
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("a", 1)]);
      const otherBoardId = await createWhiteboard(ctx, s.member, s.readOnlyChannelId);
      const attempt = async (run: () => Promise<unknown>) => {
        try {
          await run();
          return "ok";
        } catch (error) {
          return String(error);
        }
      };

      // A member without the edit-channels permission cannot change it.
      const memberToggle = await attempt(() =>
        setChannelWhiteboardsEnabled(ctx, s.member, s.channelId, false),
      );
      // The admin holds the edit-channels permission.
      await setChannelWhiteboardsEnabled(ctx, s.admin, s.channelId, false);
      const off = {
        channelFlag: (await ctx.db.get(s.channelId))!.whiteboardsEnabled,
        list: await listChannelWhiteboards(ctx, s.member, s.channelId, 0),
        changes: await listWhiteboardChanges(ctx, s.member, boardId, 0),
        create: await attempt(() => createWhiteboard(ctx, s.member, s.channelId)),
        save: await attempt(() => saveWhiteboardElements(ctx, s.member, boardId, [shape("b", 1)])),
        adminSave: await attempt(() => saveWhiteboardElements(ctx, s.admin, boardId, [shape("b", 1)])),
        // Other channels are unaffected.
        otherChannel: (
          await saveWhiteboardElements(ctx, s.member, otherBoardId, [shape("o", 1)])
        ).accepted,
        // Staff audit review does not depend on the channel setting.
        snapshot: (await getWhiteboardSnapshot(ctx, boardId, 1))?.elements.length,
      };
      await setChannelWhiteboardsEnabled(ctx, s.admin, s.channelId, true);
      const on = {
        list: (await listChannelWhiteboards(ctx, s.member, s.channelId, 0))?.boards.map(
          (board) => board.title,
        ),
        save: (await saveWhiteboardElements(ctx, s.member, boardId, [shape("b", 1)])).accepted,
      };
      const audits = (
        await ctx.db
          .query("auditEvents")
          .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
            q.eq("entityType", "ClubChannel").eq("entityId", s.channelId),
          )
          .collect()
      ).map((row) => row.action);
      return { memberToggle, off, on, audits };
    });

    expect(result.memberToggle).toMatch(/permission/);
    expect(result.off.channelFlag).toBe(false);
    expect(result.off.list).toBeNull();
    expect(result.off.changes).toBeNull();
    expect(result.off.create).toMatch(/turned off/);
    expect(result.off.save).toMatch(/turned off/);
    expect(result.off.adminSave).toMatch(/turned off/);
    expect(result.off.otherChannel).toBe(1);
    expect(result.off.snapshot).toBe(1);
    expect(result.on).toEqual({ list: ["Kept"], save: 1 });
    expect(result.audits).toEqual([
      "CLUB_CHANNEL_WHITEBOARDS_DISABLED",
      "CLUB_CHANNEL_WHITEBOARDS_ENABLED",
    ]);
  });

  test("reports elements it cannot store without failing the rest of the save", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      const saved = await saveWhiteboardElements(ctx, s.member, boardId, [
        shape("ok", 1),
        shape("img", 1, { type: "image" }),
      ]);
      return { saved, clock: await clockOf(ctx, boardId) };
    });
    expect(result.saved.accepted).toBe(1);
    expect(result.saved.rejected).toEqual([
      { elementId: "img", kind: "invalid", reason: expect.stringMatching(/not supported/) },
    ]);
    expect(result.clock).toEqual({ seq: 1, live: 1 });
  });

  test("a full board applies removals first and reports what did not fit", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("old", 1)]);
      const clock = await ctx.db
        .query("clubWhiteboardClocks")
        .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
        .unique();
      // Pretend the board already holds the maximum number of live shapes.
      await ctx.db.patch(clock!._id, { liveElementCount: 5_000 });
      const saved = await saveWhiteboardElements(ctx, s.member, boardId, [
        shape("first", 1),
        shape("second", 1),
        shape("old", 2, { isDeleted: true }),
      ]);
      return { saved, clock: await clockOf(ctx, boardId) };
    });
    expect(result.saved.accepted).toBe(2);
    expect(result.saved.rejected).toEqual([
      { elementId: "second", kind: "full", reason: "This whiteboard is full" },
    ]);
    expect(result.clock.live).toBe(5_000);
  });

  test("never stores shapes that were erased before they were first saved", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      const saved = await saveWhiteboardElements(
        ctx,
        s.member,
        boardId,
        Array.from({ length: 50 }, (_, index) => shape(`ghost${index}`, 2, { isDeleted: true })),
      );
      return {
        saved,
        rows: (await listWhiteboardChanges(ctx, s.member, boardId, 0))!.changes.length,
      };
    });
    expect(result.saved).toMatchObject({ accepted: 0, ignored: 50, rejected: [] });
    expect(result.rows).toBe(0);
  });

  test("prunes day-old erased elements while restores still bring them back", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const t = convexTest(schema, modules);
    const { boardId, memberId } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("kept", 1), shape("erased", 1)]);
      await saveWhiteboardElements(ctx, s.member, boardId, [shape("erased", 4, { isDeleted: true })]);
      return { boardId, memberId: s.member._id };
    });
    vi.setSystemTime(1_000_000 + 25 * 60 * 60 * 1000);
    await t.mutation(internal.clubs.whiteboards.pruneErasedWhiteboardElements, {});
    const result = await t.run(async (ctx) => {
      const member = (await ctx.db.get(memberId))!;
      const rowsAfterPrune = (await listWhiteboardChanges(ctx, member, boardId, 0))!.changes.map(
        (change) => JSON.parse(change.data).id,
      );
      await restoreWhiteboardVersion(ctx, member, boardId, 2);
      const restored = (await listWhiteboardChanges(ctx, member, boardId, 0))!.changes.map(
        (change) => JSON.parse(change.data),
      );
      return {
        rowsAfterPrune,
        restored: restored.map((element) => ({
          id: element.id,
          deleted: element.isDeleted,
          version: element.version,
        })),
      };
    });
    expect(result.rowsAfterPrune).toEqual(["kept"]);
    // Above the erased version any stale client may still hold.
    expect(result.restored).toContainEqual({ id: "erased", deleted: false, version: 5 });
  });

  test("restores recent versions of boards with long histories", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      // Twelve thousand earlier writes to one shape, more than a restore
      // could ever walk.
      for (let version = 1; version <= 12_000; version += 1) {
        await ctx.db.insert("clubWhiteboardHistory", {
          boardId,
          seq: version,
          elementId: "busy",
          isDeleted: false,
          data: shape("busy", version),
          actorId: s.member._id,
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
        updatedById: s.member._id,
        updatedAt: 1,
      });
      const clock = await ctx.db
        .query("clubWhiteboardClocks")
        .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
        .unique();
      await ctx.db.patch(clock!._id, { seq: 12_000, liveElementCount: 1 });
      await saveWhiteboardElements(ctx, s.member, boardId, [
        shape("note", 1, { type: "text", text: "keep" }),
      ]);
      await saveWhiteboardElements(ctx, s.otherMember, boardId, [
        shape("note", 2, { type: "text", text: "oops" }),
      ]);
      const preview = await getWhiteboardSnapshot(ctx, boardId, 12_001);
      const restored = await restoreWhiteboardVersion(ctx, s.member, boardId, 12_001);
      return {
        preview: { texts: texts(preview), truncated: preview!.truncated },
        restored,
        now: texts(await getWhiteboardSnapshot(ctx, boardId, (await clockOf(ctx, boardId)).seq)),
      };
    });
    expect(result.preview).toEqual({ texts: ["busy", "keep"], truncated: false });
    expect(result.restored.changed).toBe(1);
    expect([...result.now].sort()).toEqual(["busy", "keep"]);
  });

  test("duplicates every live element on the server in batches", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { sourceId, copyId } = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const sourceId = await createWhiteboard(ctx, s.member, s.channelId, { title: "Source" });
      for (let start = 0; start < 250; start += 125) {
        await saveWhiteboardElements(
          ctx,
          s.member,
          sourceId,
          Array.from({ length: 125 }, (_, index) => shape(`e${start + index}`, 1)),
        );
      }
      await saveWhiteboardElements(ctx, s.member, sourceId, [shape("e0", 2, { isDeleted: true })]);
      const copyId = await createWhiteboard(ctx, s.otherMember, s.channelId, {
        title: "Source (copy)",
        duplicatedFromBoardId: sourceId,
      });
      return { sourceId, copyId };
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const result = await t.run(async (ctx) => ({
      source: await clockOf(ctx, sourceId),
      copy: await clockOf(ctx, copyId),
      copiedErased: await ctx.db
        .query("clubWhiteboardElements")
        .withIndex("by_boardId_and_elementId", (q) => q.eq("boardId", copyId).eq("elementId", "e0"))
        .unique(),
    }));
    expect(result.source.live).toBe(249);
    expect(result.copy).toEqual({ seq: 249, live: 249 });
    expect(result.copiedErased).toBeNull();
  });

  test("counts people on a board from presence, not pointer movement", async () => {
    const t = convexTest(schema, modules);
    const counts = await t.run(async (ctx) => {
      const s = await seed(ctx);
      const boardId = await createWhiteboard(ctx, s.member, s.channelId);
      const count = async () =>
        (await listChannelWhiteboards(ctx, s.member, s.channelId, 100))!.boards[0]!
          .activeViewerCount;
      await ctx.db.insert("clubWhiteboardCursors", {
        boardId,
        userId: s.otherMember._id,
        x: 1,
        y: 1,
        button: "up",
        updatedAt: 200,
      });
      const cursorOnly = await count();
      await ctx.db.insert("clubWhiteboardPresence", {
        boardId,
        userId: s.otherMember._id,
        lastSeenAt: 150,
      });
      await ctx.db.insert("clubWhiteboardPresence", {
        boardId,
        userId: s.member._id,
        lastSeenAt: 50,
      });
      return { cursorOnly, present: await count() };
    });
    expect(counts).toEqual({ cursorOnly: 0, present: 1 });
  });
});


/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema from "../schema";
import { schoolTimestamp } from "../../lib/schoolTime";

// Exercise the real active-user/password-reset guards; replace only the auth adapter.
vi.mock("../auth", async (original) => {
  const actual = await original<typeof import("../auth")>();
  return {
    ...actual,
    authComponent: {
      ...actual.authComponent,
      safeGetAuthUser: async (ctx: QueryCtx) => {
        const identity = await ctx.auth.getUserIdentity();
        return identity ? { _id: identity.subject } : null;
      },
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");
const NOW = schoolTimestamp({
  year: 2026,
  month: 10,
  day: 30,
  hour: 10,
  minute: 30,
});

function friday(ctx: MutationCtx, day: number, month = 10) {
  return ctx.db.insert("flexFridays", {
    date: schoolTimestamp({ year: 2026, month, day, hour: 12 }),
    type: "ALL_STUDENT",
    isSchoolDay: true,
    createdAt: 1,
  });
}

function session(
  ctx: MutationCtx,
  flexFridayId: Id<"flexFridays">,
  startTime: string,
  endTime: string,
) {
  return ctx.db.insert("flexSessions", {
    flexFridayId,
    title: `Block ${startTime}`,
    startTime,
    endTime,
    sessionType: "STUDENT_CHOICE",
    createdAt: 1,
    updatedAt: 1,
  });
}

async function workshop(
  ctx: MutationCtx,
  teacherId: Id<"users">,
  sessionIds: Id<"flexSessions">[],
  title = "Robotics",
) {
  const id = await ctx.db.insert("flexWorkshops", {
    teacherId,
    title,
    description: "Build a robot",
    location: "Lab 204",
    capacity: 20,
    targetGrades: [],
    targetMajorPathways: [],
    targetMinorPathways: [],
    createdAt: 1,
    updatedAt: 1,
  });
  for (const sessionId of sessionIds) {
    await ctx.db.insert("flexWorkshopSessions", {
      workshopId: id,
      sessionId,
      createdAt: 1,
    });
  }
  return id;
}

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (authUserId: string, teacher: boolean) =>
      ctx.db.insert("users", {
        authUserId,
        uniqueId: authUserId,
        firstName: authUserId,
        lastName: "Person",
        preferredName: `${authUserId} preferred`,
        email: `${authUserId}@private.example`,
        roles: teacher ? ["TEACHER"] : ["STUDENT"],
        isStudent: !teacher,
        isTeacherStaff: teacher,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: authUserId,
        createdAt: 1,
        updatedAt: 1,
      });
    return {
      studentId: await user("student", false),
      otherId: await user("other", false),
      teacherId: await user("teacher", true),
      otherTeacherId: await user("other-teacher", true),
    };
  });
  return {
    t,
    ...ids,
    student: t.withIdentity({ subject: "student" }),
    other: t.withIdentity({ subject: "other" }),
    teacher: t.withIdentity({ subject: "teacher" }),
  };
}

describe("personal Flex workshop queries", () => {
  it("authenticates detail and suggestions, including inactive and reset-required users", async () => {
    const { t, student, studentId } = await fixture();
    const args = { flexFridayId: "bad", workshopId: "bad" };
    await expect(
      t.query(api.flexFriday.workshops.detail, args),
    ).rejects.toThrow("Unauthenticated");
    await expect(
      t.query(api.flexFriday.workshops.upcomingPersonal, { now: NOW }),
    ).rejects.toThrow("Unauthenticated");
    await t.run((ctx) => ctx.db.patch(studentId, { isActive: false }));
    await expect(
      student.query(api.flexFriday.workshops.detail, args),
    ).rejects.toThrow("Unauthenticated");
    await expect(
      student.query(api.flexFriday.workshops.upcomingPersonal, { now: NOW }),
    ).rejects.toThrow("Unauthenticated");
    await t.run((ctx) =>
      ctx.db.patch(studentId, { isActive: true, mustResetPassword: true }),
    );
    await expect(
      student.query(api.flexFriday.workshops.detail, args),
    ).rejects.toThrow("Password reset required");
    await expect(
      student.query(api.flexFriday.workshops.upcomingPersonal, { now: NOW }),
    ).rejects.toThrow("Password reset required");
  });

  it("returns every same-Friday segment in order and only public teacher/viewer data", async () => {
    const { t, student, other, teacher, studentId, otherId, teacherId } =
      await fixture();
    const ids = await t.run(async (ctx) => {
      const day = await friday(ctx, 30);
      const unrelated = await friday(ctx, 6, 11);
      const second = await session(ctx, day, "10:00", "11:00");
      const first = await session(ctx, day, "09:00", "10:00");
      const foreign = await session(ctx, unrelated, "09:00", "10:00");
      const item = await workshop(ctx, teacherId, [second, first, foreign]);
      await ctx.db.insert("flexRegistrations", {
        workshopId: item,
        studentId,
        createdAt: 1,
      });
      await ctx.db.insert("flexAssignments", {
        workshopId: item,
        studentId: otherId,
        assignedBy: teacherId,
        createdAt: 1,
      });
      return { flexFridayId: day, workshopId: item, first, second };
    });
    const result = await student.query(api.flexFriday.workshops.detail, {
      flexFridayId: ids.flexFridayId,
      workshopId: ids.workshopId,
    });
    expect(result?.sessions.map((row) => row._id)).toEqual([
      ids.first,
      ids.second,
    ]);
    expect(result?.sessions[0]?.startAt).toBe(
      schoolTimestamp({ year: 2026, month: 10, day: 30, hour: 9 }),
    );
    expect(result?.viewer).toEqual({
      registered: true,
      assigned: false,
      teaching: false,
    });
    expect(result?.teacher).toEqual({
      _id: teacherId,
      firstName: "teacher",
      lastName: "Person",
      preferredName: "teacher preferred",
    });
    expect(Object.keys(result!).sort()).toEqual([
      "friday",
      "sessions",
      "teacher",
      "timeZone",
      "viewer",
      "workshop",
    ]);
    const assigned = await other.query(api.flexFriday.workshops.detail, {
      flexFridayId: ids.flexFridayId,
      workshopId: ids.workshopId,
    });
    expect(assigned?.viewer).toEqual({
      registered: false,
      assigned: true,
      teaching: false,
    });
    expect(
      (
        await teacher.query(api.flexFriday.workshops.detail, {
          flexFridayId: ids.flexFridayId,
          workshopId: ids.workshopId,
        })
      )?.viewer.teaching,
    ).toBe(true);
  });

  it("treats malformed, wrong-table, wrong-Friday and deleted resources as not found", async () => {
    const { t, student, teacherId } = await fixture();
    const ids = await t.run(async (ctx) => {
      const correct = await friday(ctx, 30);
      const wrong = await friday(ctx, 6, 11);
      const block = await session(ctx, correct, "09:00", "10:00");
      return {
        correct,
        wrong,
        block,
        item: await workshop(ctx, teacherId, [block]),
      };
    });
    for (const args of [
      { flexFridayId: "bad", workshopId: ids.item },
      { flexFridayId: ids.correct, workshopId: "bad" },
      { flexFridayId: ids.block, workshopId: ids.item },
      { flexFridayId: ids.wrong, workshopId: ids.item },
    ])
      expect(
        await student.query(api.flexFriday.workshops.detail, args),
      ).toBeNull();
    await t.run((ctx) => ctx.db.delete(ids.item));
    expect(
      await student.query(api.flexFriday.workshops.detail, {
        flexFridayId: ids.correct,
        workshopId: ids.item,
      }),
    ).toBeNull();
  });

  it("includes today's underway workshop as one item, retaining completed earlier segments", async () => {
    const { t, student, studentId, teacherId } = await fixture();
    const ids = await t.run(async (ctx) => {
      const day = await friday(ctx, 30);
      const first = await session(ctx, day, "09:00", "10:00");
      const second = await session(ctx, day, "10:00", "11:00");
      const item = await workshop(ctx, teacherId, [second, first]);
      await ctx.db.insert("flexRegistrations", {
        workshopId: item,
        studentId,
        createdAt: 1,
      });
      await ctx.db.insert("flexAssignments", {
        workshopId: item,
        studentId,
        assignedBy: teacherId,
        createdAt: 1,
      });
      return { day, first, second, item };
    });
    const result = await student.query(
      api.flexFriday.workshops.upcomingPersonal,
      { now: NOW },
    );
    expect(result.friday?._id).toBe(ids.day);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      workshopId: ids.item,
      registered: true,
      assigned: true,
      teaching: false,
    });
    expect(result.items[0]?.sessions.map((row) => row._id)).toEqual([
      ids.first,
      ids.second,
    ]);
    expect(result.timeZone).toBe("America/New_York");
    expect(result.hasMore).toBe(false);
  });

  it("skips past, finished-today and irrelevant nearer Fridays for the next assigned workshop", async () => {
    const { t, student, other, studentId, teacherId, otherId } =
      await fixture();
    const future = await t.run(async (ctx) => {
      for (const day of [23, 30]) {
        const date = await friday(ctx, day);
        const block = await session(ctx, date, "08:00", "09:00");
        const item = await workshop(ctx, teacherId, [block], "Finished");
        await ctx.db.insert("flexRegistrations", {
          workshopId: item,
          studentId,
          createdAt: 1,
        });
      }
      const nearer = await friday(ctx, 6, 11);
      const block = await session(ctx, nearer, "09:00", "10:00");
      const item = await workshop(
        ctx,
        teacherId,
        [block],
        "Other student's workshop",
      );
      await ctx.db.insert("flexRegistrations", {
        workshopId: item,
        studentId: otherId,
        createdAt: 1,
      });
      const later = await friday(ctx, 13, 11);
      const laterBlock = await session(ctx, later, "09:00", "10:00");
      const assigned = await workshop(
        ctx,
        teacherId,
        [laterBlock],
        "My assigned workshop",
      );
      await ctx.db.insert("flexAssignments", {
        workshopId: assigned,
        studentId,
        assignedBy: teacherId,
        createdAt: 1,
      });
      return { nearer, later, assigned };
    });
    const result = await student.query(
      api.flexFriday.workshops.upcomingPersonal,
      { now: NOW },
    );
    expect(result.friday?._id).toBe(future.later);
    expect(result.items.map((row) => row.workshopId)).toEqual([
      future.assigned,
    ]);
    expect(result.items[0]?.sessions[0]?.startAt).toBe(
      Date.UTC(2026, 10, 13, 14),
    ); // EST after DST.
    expect(result.items[0]).toMatchObject({
      registered: false,
      assigned: true,
    });
    expect(
      (
        await other.query(api.flexFriday.workshops.upcomingPersonal, {
          now: NOW,
        })
      ).friday?._id,
    ).toBe(future.nearer);
  });

  it("shows only the staff viewer's teaching responsibilities, with no roster counts", async () => {
    const { t, teacher, student, teacherId, otherTeacherId, studentId } =
      await fixture();
    const own = await t.run(async (ctx) => {
      const nearer = await friday(ctx, 30);
      const first = await session(ctx, nearer, "11:00", "12:00");
      await workshop(ctx, otherTeacherId, [first], "Someone else's class");
      const later = await friday(ctx, 6, 11);
      const second = await session(ctx, later, "11:00", "12:00");
      const item = await workshop(ctx, teacherId, [second], "My teaching");
      await ctx.db.insert("flexRegistrations", {
        workshopId: item,
        studentId,
        createdAt: 1,
      });
      return item;
    });
    const result = await teacher.query(
      api.flexFriday.workshops.upcomingPersonal,
      { now: NOW },
    );
    expect(result.student).toBe(false);
    expect(result.items.map((row) => row.workshopId)).toEqual([own]);
    expect(result.items[0]).toMatchObject({
      teaching: true,
      registered: false,
      assigned: false,
    });
    expect(result.items[0]).not.toHaveProperty("registrations");
    expect(result.items[0]).not.toHaveProperty("registeredCount");
    expect(
      (
        await student.query(api.flexFriday.workshops.upcomingPersonal, {
          now: NOW,
        })
      ).items[0]?.teaching,
    ).toBe(false);
  });

  it("uses the school date at UTC midnight and excludes a workshop at its exact end", async () => {
    const { t, student, studentId, teacherId } = await fixture();
    await t.run(async (ctx) => {
      const date = await friday(ctx, 30);
      const block = await session(ctx, date, "20:00", "23:00");
      const item = await workshop(ctx, teacherId, [block]);
      await ctx.db.insert("flexRegistrations", {
        workshopId: item,
        studentId,
        createdAt: 1,
      });
    });
    expect(
      (
        await student.query(api.flexFriday.workshops.upcomingPersonal, {
          now: Date.UTC(2026, 9, 31, 1),
        })
      ).items,
    ).toHaveLength(1);
    expect(
      (
        await student.query(api.flexFriday.workshops.upcomingPersonal, {
          now: Date.UTC(2026, 9, 31, 3),
        })
      ).items,
    ).toHaveLength(0);
  });

  it("enforces the result limit with hasMore and preserves whole workshop sessions", async () => {
    const { t, student, studentId, teacherId } = await fixture();
    await t.run(async (ctx) => {
      const date = await friday(ctx, 30);
      const first = await session(ctx, date, "11:00", "12:00");
      const second = await session(ctx, date, "13:00", "14:00");
      for (let i = 0; i < 12; i++) {
        const item = await workshop(
          ctx,
          teacherId,
          [first, second],
          `Workshop ${i}`,
        );
        await ctx.db.insert("flexRegistrations", {
          workshopId: item,
          studentId,
          createdAt: 1,
        });
      }
    });
    const limited = await student.query(
      api.flexFriday.workshops.upcomingPersonal,
      { now: NOW, limit: 2 },
    );
    expect(limited.items).toHaveLength(2);
    expect(limited.items.every((item) => item.sessions.length === 2)).toBe(
      true,
    );
    expect(limited.hasMore).toBe(true);
    expect(
      (
        await student.query(api.flexFriday.workshops.upcomingPersonal, {
          now: NOW,
          limit: 1000,
        })
      ).items,
    ).toHaveLength(10);
    await expect(
      student.query(api.flexFriday.workshops.upcomingPersonal, {
        now: Infinity,
      }),
    ).rejects.toThrow("finite");
  });

  it("reports an exhausted day-search budget rather than claiming no personal workshops exist", async () => {
    const { t, student, studentId, teacherId } = await fixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < 17; i++) {
        const day = await friday(ctx, 30 + i * 7);
        if (i === 16) {
          const block = await session(ctx, day, "11:00", "12:00");
          const item = await workshop(ctx, teacherId, [block]);
          await ctx.db.insert("flexRegistrations", {
            workshopId: item,
            studentId,
            createdAt: 1,
          });
        }
      }
    });
    expect(
      await student.query(api.flexFriday.workshops.upcomingPersonal, {
        now: NOW,
      }),
    ).toMatchObject({ friday: null, items: [], hasMore: true });
  });

  it("reports a truncated candidate scan without selecting a later Friday", async () => {
    const { t, student, studentId, teacherId, otherTeacherId } =
      await fixture();
    await t.run(async (ctx) => {
      const nearer = await friday(ctx, 30);
      const block = await session(ctx, nearer, "11:00", "12:00");
      for (let i = 0; i < 513; i++) {
        await workshop(ctx, otherTeacherId, [block], `Other workshop ${i}`);
      }
      const later = await friday(ctx, 6, 11);
      const laterBlock = await session(ctx, later, "11:00", "12:00");
      const own = await workshop(ctx, teacherId, [laterBlock]);
      await ctx.db.insert("flexRegistrations", {
        workshopId: own,
        studentId,
        createdAt: 1,
      });
    });
    expect(
      await student.query(api.flexFriday.workshops.upcomingPersonal, {
        now: NOW,
      }),
    ).toMatchObject({ friday: null, items: [], hasMore: true });
  });

  it("does not silently truncate oversized workshop details", async () => {
    const { t, student, teacherId } = await fixture();
    const args = await t.run(async (ctx) => {
      const date = await friday(ctx, 30);
      const blocks = [];
      for (let i = 0; i < 129; i++)
        blocks.push(await session(ctx, date, "11:00", "12:00"));
      return {
        flexFridayId: date,
        workshopId: await workshop(ctx, teacherId, blocks),
      };
    });
    await expect(
      student.query(api.flexFriday.workshops.detail, args),
    ).rejects.toThrow("session limit");
  });
});

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { createLinkedUser } from "./users/_lib";
import { type AppRole } from "./lib/roles";
import { type Pathway } from "./validators";

const SEED_STAFF = [
  {
    uniqueId: "SUPER001",
    firstName: "Super",
    lastName: "Admin",
    email: "superadmin@ia.school",
    roles: ["SUPER_ADMIN", "ADMIN"] as AppRole[],
    password: "SUPER001",
  },
  {
    uniqueId: "ADMIN001",
    firstName: "School",
    lastName: "Admin",
    email: "admin001@ia.school",
    roles: ["ADMIN"] as AppRole[],
    password: "ADMIN001",
  },
  {
    uniqueId: "TCH001",
    firstName: "Jane",
    lastName: "Smith",
    email: "tch001@ia.school",
    roles: ["TEACHER", "SPONSOR"] as AppRole[],
    password: "TCH001",
  },
];

const SEED_STUDENTS = [
  {
    uniqueId: "STU001",
    firstName: "Alex",
    lastName: "Johnson",
    email: "stu001@students.ia.school",
    gradeLevel: 9,
    major: "INFORMATION_TECHNOLOGY" as Pathway,
    minor: "ENGINEERING" as Pathway,
    roles: ["STUDENT"] as AppRole[],
    password: "STU001",
  },
  {
    uniqueId: "STU002",
    firstName: "Sam",
    lastName: "Lee",
    email: "stu002@students.ia.school",
    gradeLevel: 10,
    major: "HEALTH_SCIENCE" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT"] as AppRole[],
    password: "STU002",
  },
  {
    uniqueId: "STU003",
    firstName: "Jordan",
    lastName: "Park",
    email: "stu003@students.ia.school",
    gradeLevel: 11,
    major: "ENGINEERING" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT"] as AppRole[],
    password: "STU003",
  },
  {
    uniqueId: "STU004",
    firstName: "Taylor",
    lastName: "Kim",
    email: "stu004@students.ia.school",
    gradeLevel: 12,
    major: "INFORMATION_TECHNOLOGY" as Pathway,
    minor: "HEALTH_SCIENCE" as Pathway,
    roles: ["STUDENT"] as AppRole[],
    password: "STU004",
  },
];

const SEED_USERS = [...SEED_STAFF, ...SEED_STUDENTS];

export const run = internalMutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    upserted: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Invalid bootstrap secret.");
    }
    const cursor = Math.max(0, Number.parseInt(args.cursor ?? "0", 10) || 0);
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 1), 1), 3);
    
    if (args.reset && cursor === 0) {
      const usersToDelete = await ctx.db.query("users").take(100);
      for (const user of usersToDelete) {
        await ctx.db.delete(user._id);
      }
      if (usersToDelete.length > 0) {
        return {
          deleted: usersToDelete.length,
          upserted: 0,
          nextCursor: "0",
          isDone: false,
        };
      }
    }

    let upserted = 0;
    for (const student of SEED_USERS.slice(cursor, cursor + batchSize)) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", student.uniqueId))
        .unique();
      if (existing) {
        upserted += 1;
        continue;
      }
      await createLinkedUser(ctx, {
        ...student,
        mustResetPassword: false,
      });
      upserted += 1;
    }

    const nextIndex = cursor + batchSize;
    return {
      deleted: 0,
      upserted,
      nextCursor: nextIndex < SEED_USERS.length ? String(nextIndex) : null,
      isDone: nextIndex >= SEED_USERS.length,
    };
  },
});

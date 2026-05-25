import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { COURSE_SEEDS } from "./seeddata/courses";
import { BASE_BLOCKS, SCHEDULE_WEEKDAYS, buildScheduleCourses, compareStudents, stableScheduleVisibility } from "./seeddata/schedule";
import { seedDefaultBlocks, seedAcceptedFriendPairs, deleteSeedBatch } from "./schedule/_lib";
import { courseSeedToDocument } from "./courses/_lib";
import { isStudentUser, createLinkedUser } from "./users/_lib";
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

export const run = internalMutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Invalid bootstrap secret.");
    }
    const now = Date.now();
    
    // 1. Reset if requested
    if (args.reset) {
       await deleteSeedBatch(ctx);
       const usersToDelete = await ctx.db.query("users").take(1000);
       for (const u of usersToDelete) {
         await ctx.db.delete(u._id);
       }
    }

    // 2. Seed Courses
    for (const seed of COURSE_SEEDS) {
        const existing = await ctx.db
          .query("courses")
          .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
          .unique();
        const value = courseSeedToDocument(seed, now);
        if (existing) {
          await ctx.db.patch(existing._id, value);
        } else {
          await ctx.db.insert("courses", { ...value, createdAt: now });
        }
    }

    // 3. Seed Users/Auth
    for (const staff of SEED_STAFF) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", staff.uniqueId))
        .unique();
      if (!existing) {
        await createLinkedUser(ctx, {
          ...staff,
          mustResetPassword: false,
        });
      }
    }

    for (const student of SEED_STUDENTS) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", student.uniqueId))
        .unique();
      if (!existing) {
        await createLinkedUser(ctx, {
          ...student,
          mustResetPassword: false,
        });
      }
    }
    
    // 4. Seed Schedule
    const users = await ctx.db.query("users").take(5000);
    const students = users
      .filter((u) => u.isActive && isStudentUser(u))
      .sort(compareStudents);
      
    if (users.length > 0) {
      await seedDefaultBlocks(ctx, users[0]._id, now, SCHEDULE_WEEKDAYS, BASE_BLOCKS as unknown as any[]);
      await seedAcceptedFriendPairs(ctx, students, now);
    }
  },
});

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { createLinkedUser } from "./users/_lib";
import { incrementUserCounts } from "./stats";
import { type AppRole } from "../lib/roles";
import {
  seedProfileValidator,
  type Pathway,
  type SeedProfile,
} from "./validators";

const STUDENT_COUNT_BY_PROFILE: Record<SeedProfile, number> = {
  development: 50,
  full: 1500,
};

// This password is intentionally shared by local demo accounts only. The
// local deployment is disposable and is never used for production data.
export const LOCAL_DEMO_PASSWORD = "STU001STU001";

export function isLocalDemoSeedEnabled(value: string | undefined) {
  return value === "true";
}

const FIRST_NAMES = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Elizabeth",
  "David",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Charles",
  "Karen",
  "Christopher",
  "Lisa",
  "Daniel",
  "Nancy",
  "Matthew",
  "Betty",
  "Anthony",
  "Sandra",
  "Mark",
  "Margaret",
  "Donald",
  "Ashley",
  "Steven",
  "Kimberly",
  "Paul",
  "Emily",
  "Andrew",
  "Donna",
  "Joshua",
  "Michelle",
  "Kenneth",
  "Carol",
  "Kevin",
  "Amanda",
  "Brian",
  "Dorothy",
  "George",
  "Melissa",
  "Timothy",
  "Deborah",
  "Ronald",
  "Stephanie",
  "Edward",
  "Rebecca",
  "Jason",
  "Sharon",
  "Jeffrey",
  "Cynthia",
  "Ryan",
  "Kathleen",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Gomez",
  "Phillips",
  "Evans",
  "Turner",
  "Diaz",
  "Parker",
  "Cruz",
  "Edwards",
  "Collins",
  "Reyes",
];

const ANCHOR_STUDENTS = [
  {
    uniqueId: "STU001",
    firstName: "Alex",
    lastName: "Johnson",
    email: "stu001@students.ia.school",
    gradeLevel: 9,
    major: "INFORMATION_TECHNOLOGY" as Pathway,
    minor: "ENGINEERING" as Pathway,
    roles: ["STUDENT", "STUDENT_ADMIN"] as AppRole[],
  },
  {
    uniqueId: "STU002",
    firstName: "Sam",
    lastName: "Lee",
    email: "stu002@students.ia.school",
    gradeLevel: 10,
    major: "HEALTH_SCIENCE" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT", "STUDENT_LEADER"] as AppRole[],
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
  },
  {
    uniqueId: "STU005",
    firstName: "Morgan",
    lastName: "Patel",
    email: "stu005@students.ia.school",
    gradeLevel: 9,
    major: "ENGINEERING" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
  {
    uniqueId: "STU006",
    firstName: "Riley",
    lastName: "Nguyen",
    email: "stu006@students.ia.school",
    gradeLevel: 10,
    major: "INFORMATION_TECHNOLOGY" as Pathway,
    minor: "ENGINEERING" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
  {
    uniqueId: "STU007",
    firstName: "Casey",
    lastName: "Brooks",
    email: "stu007@students.ia.school",
    gradeLevel: 11,
    major: "HEALTH_SCIENCE" as Pathway,
    minor: "ENGINEERING" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
  {
    uniqueId: "STU008",
    firstName: "Avery",
    lastName: "Rivera",
    email: "stu008@students.ia.school",
    gradeLevel: 12,
    major: "ENGINEERING" as Pathway,
    minor: "HEALTH_SCIENCE" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
  {
    uniqueId: "STU009",
    firstName: "Quinn",
    lastName: "Carter",
    email: "stu009@students.ia.school",
    gradeLevel: 10,
    major: "INFORMATION_TECHNOLOGY" as Pathway,
    minor: "HEALTH_SCIENCE" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
  {
    uniqueId: "STU010",
    firstName: "Jamie",
    lastName: "Flores",
    email: "stu010@students.ia.school",
    gradeLevel: 11,
    major: "HEALTH_SCIENCE" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT"] as AppRole[],
  },
];

function getDeterministicName(index: number, usedNames: Set<string>) {
  let firstNameIdx = index % FIRST_NAMES.length;
  let lastNameIdx = Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length;
  let attempt = 0;
  while (attempt < 3600) {
    const firstName = FIRST_NAMES[firstNameIdx];
    const lastName = LAST_NAMES[lastNameIdx];
    const fullName = `${firstName} ${lastName}`;
    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      return { firstName, lastName };
    }
    firstNameIdx = (firstNameIdx + 1) % FIRST_NAMES.length;
    if (firstNameIdx === 0) {
      lastNameIdx = (lastNameIdx + 1) % LAST_NAMES.length;
    }
    attempt++;
  }
  return { firstName: `User${index}`, lastName: `Seed` };
}

function nextKeyWithRemaining<T extends string | number>(
  values: T[],
  remaining: Map<T, number>,
): T {
  const sorted = [...values].sort(
    (left, right) => (remaining.get(right) ?? 0) - (remaining.get(left) ?? 0),
  );
  return sorted.find((value) => (remaining.get(value) ?? 0) > 0)!;
}

function targetShare(total: number, index: number, parts: number) {
  return Math.floor(total / parts) + (index < total % parts ? 1 : 0);
}

function generateUsers(studentCount: number) {
  const usedNames = new Set<string>();
  const staffSeeds: any[] = [
    {
      uniqueId: "SUPER001",
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@ia.school",
      roles: ["SUPER_ADMIN", "ADMIN"] as AppRole[],
    },
    {
      uniqueId: "ADMIN001",
      firstName: "School",
      lastName: "Admin",
      email: "admin001@ia.school",
      roles: ["ADMIN"] as AppRole[],
    },
    {
      uniqueId: "TCH001",
      firstName: "Jane",
      lastName: "Smith",
      email: "tch001@ia.school",
      roles: ["TEACHER"] as AppRole[],
    },
  ];

  for (const person of [...staffSeeds, ...ANCHOR_STUDENTS]) {
    usedNames.add(`${person.firstName} ${person.lastName}`);
  }

  // Generate Admins ADMIN002 - ADMIN004
  for (let i = 2; i <= 4; i++) {
    const { firstName, lastName } = getDeterministicName(i, usedNames);
    const uniqueId = `ADMIN${String(i).padStart(3, "0")}`;
    staffSeeds.push({
      uniqueId,
      firstName,
      lastName,
      email: `admin${String(i).padStart(3, "0")}@ia.school`,
      roles: ["ADMIN"] as AppRole[],
    });
  }

  // Generate Teachers TCH002 - TCH085
  for (let i = 2; i <= 85; i++) {
    const { firstName, lastName } = getDeterministicName(i + 10, usedNames);
    const uniqueId = `TCH${String(i).padStart(3, "0")}`;
    staffSeeds.push({
      uniqueId,
      firstName,
      lastName,
      email: `tch${String(i).padStart(3, "0")}@ia.school`,
      roles: ["TEACHER"] as AppRole[],
    });
  }

  // Generate Support Staff STF001 - STF029
  for (let i = 1; i <= 29; i++) {
    const { firstName, lastName } = getDeterministicName(i + 150, usedNames);
    const uniqueId = `STF${String(i).padStart(3, "0")}`;
    staffSeeds.push({
      uniqueId,
      firstName,
      lastName,
      email: `stf${String(i).padStart(3, "0")}@ia.school`,
      roles: ["SUPPORT_STAFF"] as AppRole[],
    });
  }

  const sponsorUniqueIds = new Set<string>([
    "TCH001",
    ...staffSeeds
      .filter((user) => user.uniqueId.startsWith("TCH"))
      .slice(1, 29)
      .map((user) => user.uniqueId),
    ...staffSeeds
      .filter((user) => user.uniqueId.startsWith("STF"))
      .slice(0, 4)
      .map((user) => user.uniqueId),
  ]);

  const normalizedStaffSeeds = staffSeeds.map((user) => ({
    ...user,
    roles:
      sponsorUniqueIds.has(user.uniqueId) && !user.roles.includes("SPONSOR")
        ? ([...user.roles, "SPONSOR"] as AppRole[])
        : user.roles,
  }));

  const grades = [9, 10, 11, 12];
  const gradeRemaining = new Map<number, number>(
    grades.map((grade, index) => [
      grade,
      targetShare(studentCount, index, grades.length) -
        ANCHOR_STUDENTS.filter((student) => student.gradeLevel === grade)
          .length,
    ]),
  );

  const PATHWAYS = ["ENGINEERING", "INFORMATION_TECHNOLOGY", "HEALTH_SCIENCE"];
  const majorRemaining = new Map<string, number>(
    PATHWAYS.map((pathway, index) => [
      pathway,
      targetShare(studentCount, index, PATHWAYS.length) -
        ANCHOR_STUDENTS.filter((student) => student.major === pathway).length,
    ]),
  );

  const generatedStudents: any[] = [];
  for (let studentNumber = 11; studentNumber <= studentCount; studentNumber++) {
    const gradeLevel = nextKeyWithRemaining([9, 10, 11, 12], gradeRemaining);
    gradeRemaining.set(gradeLevel, (gradeRemaining.get(gradeLevel) ?? 0) - 1);

    const major = nextKeyWithRemaining(PATHWAYS, majorRemaining);
    majorRemaining.set(major, (majorRemaining.get(major) ?? 0) - 1);

    const minorChoices = PATHWAYS.filter((p) => p !== major);
    const minor =
      minorChoices[(studentNumber + gradeLevel) % minorChoices.length];
    const { firstName, lastName } = getDeterministicName(
      studentNumber + 200,
      usedNames,
    );
    const uniqueId = `STU${String(studentNumber).padStart(3, "0")}`;

    generatedStudents.push({
      uniqueId,
      firstName,
      lastName,
      email: `stu${String(studentNumber).padStart(3, "0")}@students.ia.school`,
      gradeLevel,
      major: major as Pathway,
      minor: minor as Pathway,
      roles: ["STUDENT"] as AppRole[],
    });
  }

  return [...normalizedStaffSeeds, ...ANCHOR_STUDENTS, ...generatedStudents];
}

const seedUsersByProfile = new Map<
  SeedProfile,
  ReturnType<typeof generateUsers>
>();

function getSeedUsers(profile: SeedProfile) {
  const cached = seedUsersByProfile.get(profile);
  if (cached) return cached;

  const users = generateUsers(STUDENT_COUNT_BY_PROFILE[profile]);
  seedUsersByProfile.set(profile, users);
  return users;
}

export const run = internalMutation({
  args: {
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    profile: v.optional(seedProfileValidator),
  },
  returns: v.object({
    deleted: v.number(),
    upserted: v.number(),
    generatedCredentials: v.array(
      v.object({
        uniqueId: v.string(),
        temporaryPassword: v.string(),
      }),
    ),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!isLocalDemoSeedEnabled(process.env.ALLOW_LOCAL_DEMO_SEED)) {
      throw new Error(
        "Demo seed is disabled. Run it only on an isolated local deployment configured by pnpm setup:convex-local.",
      );
    }
    const profile = args.profile ?? "development";
    const seedUsers = getSeedUsers(profile);
    const cursor = Math.max(0, Number.parseInt(args.cursor ?? "0", 10) || 0);
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 1), 1), 8);

    if (args.reset && cursor === 0) {
      const usersToDelete = await ctx.db.query("users").take(100);
      for (const user of usersToDelete) {
        await incrementUserCounts(ctx, user, -1);
        await ctx.db.delete(user._id);
      }
      if (usersToDelete.length > 0) {
        return {
          deleted: usersToDelete.length,
          upserted: 0,
          generatedCredentials: [],
          nextCursor: "0",
          isDone: false,
        };
      }
    }

    let upserted = 0;
    const generatedCredentials: Array<{
      uniqueId: string;
      temporaryPassword: string;
    }> = [];
    for (const student of seedUsers.slice(cursor, cursor + batchSize)) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_uniqueId", (q) => q.eq("uniqueId", student.uniqueId))
        .unique();
      if (existing) {
        upserted += 1;
        continue;
      }
      const result = await createLinkedUser(ctx, {
        ...student,
        password: LOCAL_DEMO_PASSWORD,
        mustResetPassword: false,
      });
      if (result.temporaryPassword) {
        generatedCredentials.push({
          uniqueId: student.uniqueId,
          temporaryPassword: result.temporaryPassword,
        });
      }
      upserted += 1;
    }

    const nextIndex = cursor + batchSize;
    if (nextIndex >= seedUsers.length) {
      await ctx.runMutation(internal.stats.rebuildUserCounts, {});
    }
    return {
      deleted: 0,
      upserted,
      generatedCredentials,
      nextCursor: nextIndex < seedUsers.length ? String(nextIndex) : null,
      isDone: nextIndex >= seedUsers.length,
    };
  },
});

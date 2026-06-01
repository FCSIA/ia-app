import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { createLinkedUser } from "./users/_lib";
import { type AppRole } from "../lib/roles";
import { type Pathway } from "./validators";

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
  {
    uniqueId: "STU005",
    firstName: "Morgan",
    lastName: "Patel",
    email: "stu005@students.ia.school",
    gradeLevel: 9,
    major: "ENGINEERING" as Pathway,
    minor: "INFORMATION_TECHNOLOGY" as Pathway,
    roles: ["STUDENT"] as AppRole[],
    password: "STU005",
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
    password: "STU006",
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
    password: "STU007",
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
    password: "STU008",
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
    password: "STU009",
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
    password: "STU010",
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

function generateAllUsers() {
  const usedNames = new Set<string>();
  const staffSeeds: any[] = [
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
      roles: ["TEACHER"] as AppRole[],
      password: "TCH001",
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
      password: uniqueId,
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
      password: uniqueId,
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
      password: uniqueId,
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

  const gradeRemaining = new Map<number, number>([
    [9, 375 - ANCHOR_STUDENTS.filter((s) => s.gradeLevel === 9).length],
    [10, 375 - ANCHOR_STUDENTS.filter((s) => s.gradeLevel === 10).length],
    [11, 375 - ANCHOR_STUDENTS.filter((s) => s.gradeLevel === 11).length],
    [12, 375 - ANCHOR_STUDENTS.filter((s) => s.gradeLevel === 12).length],
  ]);

  const PATHWAYS = ["ENGINEERING", "INFORMATION_TECHNOLOGY", "HEALTH_SCIENCE"];
  const majorRemaining = new Map<string, number>([
    [
      "ENGINEERING",
      500 - ANCHOR_STUDENTS.filter((s) => s.major === "ENGINEERING").length,
    ],
    [
      "INFORMATION_TECHNOLOGY",
      500 -
        ANCHOR_STUDENTS.filter((s) => s.major === "INFORMATION_TECHNOLOGY")
          .length,
    ],
    [
      "HEALTH_SCIENCE",
      500 - ANCHOR_STUDENTS.filter((s) => s.major === "HEALTH_SCIENCE").length,
    ],
  ]);

  const generatedStudents: any[] = [];
  for (let studentNumber = 11; studentNumber <= 1500; studentNumber++) {
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
      password: uniqueId,
    });
  }

  return [...normalizedStaffSeeds, ...ANCHOR_STUDENTS, ...generatedStudents];
}

const SEED_USERS = generateAllUsers();

export const run = internalMutation({
  args: {
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
    const cursor = Math.max(0, Number.parseInt(args.cursor ?? "0", 10) || 0);
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 1), 1), 8);

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

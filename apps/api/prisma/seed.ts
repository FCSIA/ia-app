import { faker } from '@faker-js/faker';
import {
  AnnouncementStatus,
  AnnouncementTarget,
  ClubChannelVisibility,
  NotificationCategory,
  Pathway,
  PrismaClient,
  Role,
  ScheduleWeekday,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CLUB_DEFINITIONS, type SeedClubDefinition } from './seed-data/clubs';
import { COURSE_SEEDS } from './seed-data/courses';

const prisma = new PrismaClient();

const HASH_ROUNDS = 8;
const SEED = 20260417;
const STUDENT_TOTAL = 1500;
const STAFF_TOTAL = 119;
const PATHWAYS: Pathway[] = [
  Pathway.ENGINEERING,
  Pathway.INFORMATION_TECHNOLOGY,
  Pathway.HEALTH_SCIENCE,
];
const WEEKDAYS = [
  ScheduleWeekday.MONDAY,
  ScheduleWeekday.TUESDAY,
  ScheduleWeekday.WEDNESDAY,
  ScheduleWeekday.THURSDAY,
  ScheduleWeekday.FRIDAY,
];
const BASE_BLOCKS = [
  { label: 'Period 1', periodNumber: 1, startTime: '08:10', endTime: '08:55' },
  { label: 'Period 2', periodNumber: 2, startTime: '09:00', endTime: '09:45' },
  { label: 'Period 3', periodNumber: 3, startTime: '09:50', endTime: '10:35' },
  { label: 'Period 4', periodNumber: 4, startTime: '10:40', endTime: '11:25' },
  { label: 'Lunch', periodNumber: null, startTime: '11:25', endTime: '11:55' },
  { label: 'Period 5', periodNumber: 5, startTime: '12:00', endTime: '12:45' },
  { label: 'Period 6', periodNumber: 6, startTime: '12:50', endTime: '13:35' },
  { label: 'Period 7', periodNumber: 7, startTime: '13:40', endTime: '14:25' },
  { label: 'Period 8', periodNumber: 8, startTime: '14:30', endTime: '15:15' },
];

type SeedUserInput = {
  uniqueId: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: Role[];
  gradeLevel?: number | null;
  major?: Pathway | null;
  minor?: Pathway | null;
  isActive?: boolean;
};

type StudentSeed = SeedUserInput & {
  gradeLevel: number;
  major: Pathway;
  minor: Pathway;
};

type ClubRecord = {
  id: string;
  name: string;
  joinPolicy: SeedClubDefinition['joinPolicy'];
};

type CourseRecord = {
  id: string;
  slug: string;
  title: string;
  minGrade: number | null;
  maxGrade: number | null;
};

const ANCHOR_STUDENTS: StudentSeed[] = [
  {
    uniqueId: 'STU001',
    firstName: 'Alex',
    lastName: 'Johnson',
    email: 'stu001@students.ia.school',
    gradeLevel: 9,
    major: Pathway.INFORMATION_TECHNOLOGY,
    minor: Pathway.ENGINEERING,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU002',
    firstName: 'Sam',
    lastName: 'Lee',
    email: 'stu002@students.ia.school',
    gradeLevel: 10,
    major: Pathway.HEALTH_SCIENCE,
    minor: Pathway.INFORMATION_TECHNOLOGY,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU003',
    firstName: 'Jordan',
    lastName: 'Park',
    email: 'stu003@students.ia.school',
    gradeLevel: 11,
    major: Pathway.ENGINEERING,
    minor: Pathway.INFORMATION_TECHNOLOGY,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU004',
    firstName: 'Taylor',
    lastName: 'Kim',
    email: 'stu004@students.ia.school',
    gradeLevel: 12,
    major: Pathway.INFORMATION_TECHNOLOGY,
    minor: Pathway.HEALTH_SCIENCE,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU005',
    firstName: 'Morgan',
    lastName: 'Patel',
    email: 'stu005@students.ia.school',
    gradeLevel: 9,
    major: Pathway.ENGINEERING,
    minor: Pathway.INFORMATION_TECHNOLOGY,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU006',
    firstName: 'Riley',
    lastName: 'Nguyen',
    email: 'stu006@students.ia.school',
    gradeLevel: 10,
    major: Pathway.INFORMATION_TECHNOLOGY,
    minor: Pathway.ENGINEERING,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU007',
    firstName: 'Casey',
    lastName: 'Brooks',
    email: 'stu007@students.ia.school',
    gradeLevel: 11,
    major: Pathway.HEALTH_SCIENCE,
    minor: Pathway.ENGINEERING,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU008',
    firstName: 'Avery',
    lastName: 'Rivera',
    email: 'stu008@students.ia.school',
    gradeLevel: 12,
    major: Pathway.ENGINEERING,
    minor: Pathway.HEALTH_SCIENCE,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU009',
    firstName: 'Quinn',
    lastName: 'Carter',
    email: 'stu009@students.ia.school',
    gradeLevel: 10,
    major: Pathway.INFORMATION_TECHNOLOGY,
    minor: Pathway.HEALTH_SCIENCE,
    roles: [Role.STUDENT],
  },
  {
    uniqueId: 'STU010',
    firstName: 'Jamie',
    lastName: 'Flores',
    email: 'stu010@students.ia.school',
    gradeLevel: 11,
    major: Pathway.HEALTH_SCIENCE,
    minor: Pathway.INFORMATION_TECHNOLOGY,
    roles: [Role.STUDENT],
  },
];

const INTRO_BY_PATHWAY: Record<Pathway, string[]> = {
  [Pathway.ENGINEERING]: [
    'foundations-of-engineering-and-technology',
    'introduction-to-software-technology',
    'intro-to-healthcare-science',
  ],
  [Pathway.INFORMATION_TECHNOLOGY]: [
    'introduction-to-software-technology',
    'foundations-of-engineering-and-technology',
    'intro-to-healthcare-science',
  ],
  [Pathway.HEALTH_SCIENCE]: [
    'intro-to-healthcare-science',
    'introduction-to-software-technology',
    'foundations-of-engineering-and-technology',
  ],
};

const PATHWAY_ADVANCEMENT: Record<
  Pathway,
  { sophomore: string[]; junior: string[]; senior: string[] }
> = {
  [Pathway.ENGINEERING]: {
    sophomore: ['engineering-concepts'],
    junior: ['engineering-applications'],
    senior: ['research-design-and-project-management'],
  },
  [Pathway.INFORMATION_TECHNOLOGY]: {
    sophomore: [
      'ap-computer-science-principles',
      'foundations-of-artificial-intelligence',
      'introduction-to-cybersecurity',
    ],
    junior: [
      'artificial-intelligence-concepts',
      'ap-computer-science-a',
      'game-design-animation-and-simulation',
      'embedded-computing',
      'advanced-cybersecurity',
    ],
    senior: [
      'artificial-intelligence-applications',
      'programming-games-apps-and-society',
      'embedded-computing',
      'game-design-animation-and-simulation',
      'ap-computer-science-a',
    ],
  },
  [Pathway.HEALTH_SCIENCE]: {
    sophomore: ['essentials-of-healthcare', 'essentials-of-biotechnology'],
    junior: [
      'emergency-medical-responder',
      'allied-health-and-medicine',
      'surgical-technician-i',
      'pharmacy-operations-and-fundamentals',
      'applications-of-biotechnology',
    ],
    senior: [
      'allied-health-and-medicine',
      'surgical-technician-i',
      'pharmacy-operations-and-fundamentals',
      'biotechnology-internship-independent-research',
      'biol-2113-anatomy-and-physiology-i',
    ],
  },
};

const FALLBACK_ELECTIVES = {
  9: [
    'beginning-music-technology',
    'audio-visual-film-and-technology-i',
    'fvs-health',
    'fvs-personal-fitness',
    'ap-human-geography',
  ],
  10: [
    'beginning-music-technology',
    'audio-visual-film-and-technology-i',
    'fvs-health',
    'fvs-personal-fitness',
    'yearbook',
    'ap-human-geography',
    'design-fundamentals',
  ],
  11: [
    'forensic-science',
    'astronomy',
    'yearbook',
    'journalism-i',
    'beacon-writing-staff',
    'beginning-music-technology',
    'ap-psychology',
    'ap-art-history',
  ],
  12: [
    'forensic-science',
    'astronomy',
    'organic-chemistry-honors',
    'yearbook',
    'journalism-ii',
    'beacon-writing-staff',
    'ap-psychology',
    'ap-art-history',
    'peer-facilitation',
    'work-based-learning',
  ],
} as const;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createUniqueName(usedNames: Set<string>) {
  while (true) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    if (usedNames.has(fullName)) continue;
    usedNames.add(fullName);
    return { firstName, lastName };
  }
}

function nextKeyWithRemaining<T extends string | number>(
  values: T[],
  remaining: Map<T, number>,
) {
  return [...values]
    .sort(
      (left, right) =>
        (remaining.get(right) ?? 0) - (remaining.get(left) ?? 0),
    )
    .find((value) => (remaining.get(value) ?? 0) > 0)!;
}

function isCourseAllowedForGrade(course: CourseRecord, gradeLevel: number) {
  if (course.minGrade != null && gradeLevel < course.minGrade) return false;
  if (course.maxGrade != null && gradeLevel > course.maxGrade) return false;
  return true;
}

function buildScheduleSlugs(student: StudentSeed, courseMap: Map<string, CourseRecord>) {
  const picks: string[] = [];
  const used = new Set<string>();

  const pickOne = (options: string[]) => {
    const available = options.filter((slug) => {
      const course = courseMap.get(slug);
      return !!course && !used.has(slug) && isCourseAllowedForGrade(course, student.gradeLevel);
    });
    if (available.length === 0) return;
    const slug = faker.helpers.arrayElement(available);
    picks.push(slug);
    used.add(slug);
  };

  if (student.gradeLevel === 9) {
    pickOne(['literature-and-composition-i', 'literature-and-composition-i-honors']);
    pickOne([
      'algebra-concepts-and-connections',
      'algebra-concepts-and-connections-honors',
      'geometry-concepts-and-connections',
      'geometry-concepts-and-connections-honors',
    ]);
    pickOne(['biology', 'biology-honors', 'super-biology']);
    pickOne(['american-government-civics', 'ap-human-geography']);
    pickOne(['economics', 'fvs-health']);
    pickOne(INTRO_BY_PATHWAY[student.major]);
    pickOne(INTRO_BY_PATHWAY[student.minor]);
    pickOne([...FALLBACK_ELECTIVES[9]]);
  }

  if (student.gradeLevel === 10) {
    pickOne([
      'literature-and-composition-ii',
      'literature-and-composition-ii-honors',
      'ap-seminar',
    ]);
    pickOne([
      'geometry-concepts-and-connections',
      'geometry-concepts-and-connections-honors',
      'advanced-algebra-concepts-and-connections',
      'advanced-algebra-concepts-and-connections-honors',
      'enhanced-advanced-algebra-and-ap-precalculus',
    ]);
    pickOne([
      'earth-systems',
      'honors-chemistry',
      'ap-environmental-science',
      'ap-biology',
    ]);
    pickOne(['world-history', 'ap-world-history']);
    pickOne(PATHWAY_ADVANCEMENT[student.major].sophomore);
    pickOne(PATHWAY_ADVANCEMENT[student.minor].sophomore);
    pickOne([...FALLBACK_ELECTIVES[10]]);
    pickOne([
      'ap-human-geography',
      'beginning-music-technology',
      'audio-visual-film-and-technology-i',
      'yearbook',
    ]);
  }

  if (student.gradeLevel === 11) {
    pickOne([
      '11th-american-literature-and-composition',
      '11th-american-literature-and-composition-honors',
      'ap-language-and-composition',
      'world-literature',
    ]);
    pickOne([
      'pre-calculus',
      'ap-precalculus',
      'calculus',
      'ap-statistics',
      'advanced-mathematical-decision-making',
    ]);
    pickOne([
      'physics',
      'honors-physics',
      'ap-physics-1',
      'ap-biology',
      'ap-chemistry',
    ]);
    pickOne(['us-history', 'ap-us-history', 'ap-psychology']);
    pickOne(PATHWAY_ADVANCEMENT[student.major].junior);
    pickOne(PATHWAY_ADVANCEMENT[student.minor].junior);
    pickOne(['ia-research-honors', 'ap-research', 'ap-seminar']);
    pickOne([...FALLBACK_ELECTIVES[11]]);
  }

  if (student.gradeLevel === 12) {
    pickOne([
      'world-literature',
      'ap-english-literature-and-composition',
      'dramatic-writing',
      'ap-language-and-composition',
    ]);
    pickOne([
      'calculus',
      'ap-calculus-ab',
      'ap-calculus-bc',
      'ap-statistics',
      'advanced-mathematical-decision-making',
      'pre-calculus',
    ]);
    pickOne([
      'ap-chemistry',
      'ap-biology',
      'ap-physics-c-mechanics',
      'ap-physics-c-electricity-and-magnetism',
      'forensic-science',
      'astronomy',
      'organic-chemistry-honors',
    ]);
    pickOne([
      'ap-government-and-politics',
      'ap-microeconomics',
      'ap-macroeconomics',
      'ap-art-history',
      'ap-comparative-government-and-politics',
      'us-history-in-film',
      'ap-psychology',
    ]);
    pickOne(PATHWAY_ADVANCEMENT[student.major].senior);
    pickOne(PATHWAY_ADVANCEMENT[student.minor].senior);
    pickOne(['ap-research', 'ia-research-honors', 'beacon-writing-staff']);
    pickOne([...FALLBACK_ELECTIVES[12]]);
  }

  while (picks.length < 8) {
    pickOne([...FALLBACK_ELECTIVES[student.gradeLevel as 9 | 10 | 11 | 12]]);
    if (picks.length >= 8) break;
    pickOne([...courseMap.keys()]);
  }

  return picks.slice(0, 8);
}

function buildChannelBlueprints(club: SeedClubDefinition) {
  const channels: Array<{
    name: string;
    description: string;
    visibility: ClubChannelVisibility;
  }> = [
    {
      name: 'general',
      description: `Main conversation space for ${club.name}.`,
      visibility: ClubChannelVisibility.PUBLIC,
    },
    {
      name: 'announcements',
      description: `Read-only updates and reminders for ${club.name}.`,
      visibility: ClubChannelVisibility.MEMBER_READONLY,
    },
  ];

  if (club.category === 'PATHWAY') {
    channels.push(
      {
        name: 'projects',
        description: 'Build logs, project checkpoints, and student work reviews.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'resources',
        description: 'Reference links, competition docs, and mentor notes.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'officers',
        description: 'Leadership planning and sponsor coordination.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else if (club.category === 'COMPETITIVE') {
    channels.push(
      {
        name: 'competition-prep',
        description: 'Roster prep, study plans, and event readiness.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'practice',
        description: 'Weekly drills, scrimmage notes, and improvement goals.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'officers',
        description: 'Leadership logistics and travel coordination.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else if (club.category === 'LEADERSHIP') {
    channels.push(
      {
        name: 'planning',
        description: 'Event planning, service ideas, and leadership updates.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'class-voice',
        description: 'Student feedback, concerns, and classwide ideas.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'officers',
        description: 'Officer-only planning and sponsor communication.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else if (club.category === 'HONOR') {
    channels.push(
      {
        name: 'service',
        description: 'Honor society service projects and outreach updates.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'tutoring',
        description: 'Peer support, study help, and academic mentoring.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'officers',
        description: 'Leadership and sponsor planning.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else if (club.category === 'CREATIVE') {
    channels.push(
      {
        name: 'showcases',
        description: 'Works in progress, prompts, and spotlight opportunities.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'feedback',
        description: 'Structured critique notes and reference material.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'officers',
        description: 'Editorial and leadership planning.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else if (club.category === 'SERVICE') {
    channels.push(
      {
        name: 'service-events',
        description: 'Volunteer signups and event updates.',
        visibility: ClubChannelVisibility.PUBLIC,
      },
      {
        name: 'logistics',
        description: 'Planning docs and sponsor-approved operational notes.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'officers',
        description: 'Core planning team coordination.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  } else {
    channels.push(
      {
        name: 'resources',
        description: 'Study materials, reference links, and member notes.',
        visibility: ClubChannelVisibility.MEMBER_READONLY,
      },
      {
        name: 'officers',
        description: 'Leadership planning and sponsor coordination.',
        visibility: ClubChannelVisibility.PRIVATE,
      },
    );
  }

  if (club.category !== 'LEADERSHIP' && faker.number.int({ min: 0, max: 99 }) < 60) {
    channels.push({
      name: 'events',
      description: 'Meeting reminders, calendars, and event logistics.',
      visibility: ClubChannelVisibility.PUBLIC,
    });
  }

  return channels.slice(0, 10);
}

async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  const quotedTables = tables.map((row) => `"${row.tablename}"`);
  if (quotedTables.length === 0) return;

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTables.join(', ')} RESTART IDENTITY CASCADE;`,
  );
}

async function hashUsers(users: SeedUserInput[]) {
  const hashedUsers: Array<SeedUserInput & { passwordHash: string; isActive: boolean }> = [];
  for (const batch of chunkArray(users, 25)) {
    const hashedBatch = await Promise.all(
      batch.map(async (user) => ({
        ...user,
        passwordHash: await bcrypt.hash(user.uniqueId, HASH_ROUNDS),
        isActive: user.isActive ?? true,
      })),
    );
    hashedUsers.push(...hashedBatch);
  }
  return hashedUsers;
}

async function main() {
  faker.seed(SEED);

  console.log('Resetting database...');
  await resetDatabase();

  const usedNames = new Set<string>();
  const staffSeeds: SeedUserInput[] = [
    {
      uniqueId: 'SUPER001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@ia.school',
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    {
      uniqueId: 'ADMIN001',
      firstName: 'School',
      lastName: 'Admin',
      email: 'admin001@ia.school',
      roles: [Role.ADMIN],
    },
    {
      uniqueId: 'TCH001',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'tch001@ia.school',
      roles: [Role.TEACHER],
    },
  ];

  for (const person of [...staffSeeds, ...ANCHOR_STUDENTS]) {
    usedNames.add(`${person.firstName} ${person.lastName}`);
  }

  for (let index = 2; index <= 4; index += 1) {
    const name = createUniqueName(usedNames);
    staffSeeds.push({
      uniqueId: `ADMIN${String(index).padStart(3, '0')}`,
      firstName: name.firstName,
      lastName: name.lastName,
      email: `admin${String(index).padStart(3, '0')}@ia.school`,
      roles: [Role.ADMIN],
    });
  }

  for (let index = 2; index <= 85; index += 1) {
    const name = createUniqueName(usedNames);
    staffSeeds.push({
      uniqueId: `TCH${String(index).padStart(3, '0')}`,
      firstName: name.firstName,
      lastName: name.lastName,
      email: `tch${String(index).padStart(3, '0')}@ia.school`,
      roles: [Role.TEACHER],
    });
  }

  for (let index = 1; index <= 29; index += 1) {
    const name = createUniqueName(usedNames);
    staffSeeds.push({
      uniqueId: `STF${String(index).padStart(3, '0')}`,
      firstName: name.firstName,
      lastName: name.lastName,
      email: `stf${String(index).padStart(3, '0')}@ia.school`,
      roles: [Role.SUPPORT_STAFF],
    });
  }

  const sponsorUniqueIds = new Set<string>([
    'TCH001',
    ...staffSeeds.filter((user) => user.uniqueId.startsWith('TCH')).slice(1, 29).map((user) => user.uniqueId),
    ...staffSeeds.filter((user) => user.uniqueId.startsWith('STF')).slice(0, 4).map((user) => user.uniqueId),
  ]);

  const normalizedStaffSeeds = staffSeeds.map((user) => ({
    ...user,
    roles: sponsorUniqueIds.has(user.uniqueId) && !user.roles.includes(Role.SPONSOR)
      ? [...user.roles, Role.SPONSOR]
      : user.roles,
  }));

  const gradeRemaining = new Map<number, number>([
    [9, 375 - ANCHOR_STUDENTS.filter((student) => student.gradeLevel === 9).length],
    [10, 375 - ANCHOR_STUDENTS.filter((student) => student.gradeLevel === 10).length],
    [11, 375 - ANCHOR_STUDENTS.filter((student) => student.gradeLevel === 11).length],
    [12, 375 - ANCHOR_STUDENTS.filter((student) => student.gradeLevel === 12).length],
  ]);
  const majorRemaining = new Map<Pathway, number>([
    [Pathway.ENGINEERING, 500 - ANCHOR_STUDENTS.filter((student) => student.major === Pathway.ENGINEERING).length],
    [
      Pathway.INFORMATION_TECHNOLOGY,
      500 - ANCHOR_STUDENTS.filter((student) => student.major === Pathway.INFORMATION_TECHNOLOGY).length,
    ],
    [Pathway.HEALTH_SCIENCE, 500 - ANCHOR_STUDENTS.filter((student) => student.major === Pathway.HEALTH_SCIENCE).length],
  ]);

  const generatedStudents: StudentSeed[] = [];
  for (let studentNumber = 11; studentNumber <= STUDENT_TOTAL; studentNumber += 1) {
    const gradeLevel = nextKeyWithRemaining([9, 10, 11, 12], gradeRemaining);
    gradeRemaining.set(gradeLevel, (gradeRemaining.get(gradeLevel) ?? 0) - 1);

    const major = nextKeyWithRemaining(PATHWAYS, majorRemaining);
    majorRemaining.set(major, (majorRemaining.get(major) ?? 0) - 1);

    const minorChoices = PATHWAYS.filter((pathway) => pathway !== major);
    const minor = minorChoices[(studentNumber + gradeLevel) % minorChoices.length];
    const name = createUniqueName(usedNames);

    generatedStudents.push({
      uniqueId: `STU${String(studentNumber).padStart(3, '0')}`,
      firstName: name.firstName,
      lastName: name.lastName,
      email: `stu${String(studentNumber).padStart(3, '0')}@students.ia.school`,
      gradeLevel,
      major,
      minor,
      roles: [Role.STUDENT],
    });
  }

  const studentSeeds = [...ANCHOR_STUDENTS, ...generatedStudents];
  const allUsers = await hashUsers([...normalizedStaffSeeds, ...studentSeeds]);

  console.log('Creating users...');
  for (const batch of chunkArray(allUsers, 200)) {
    await prisma.user.createMany({ data: batch });
  }

  const userRows = await prisma.user.findMany({
    select: {
      id: true,
      uniqueId: true,
      gradeLevel: true,
      major: true,
      minor: true,
      roles: true,
    },
  });
  const userByUniqueId = new Map(userRows.map((user) => [user.uniqueId, user]));

  console.log(`Staff ready: ${STAFF_TOTAL}`);
  console.log(`Students ready: ${studentSeeds.length}`);

  await prisma.course.createMany({ data: COURSE_SEEDS });
  const courseRows = await prisma.course.findMany({
    select: { id: true, slug: true, title: true, minGrade: true, maxGrade: true },
  });
  const courseBySlug = new Map(courseRows.map((course) => [course.slug, course]));
  console.log(`Courses ready: ${courseRows.length}`);

  await prisma.schoolDayBlock.createMany({
    data: WEEKDAYS.flatMap((weekday) =>
      BASE_BLOCKS.map((block) => ({
        weekday,
        label: block.label,
        periodNumber: block.periodNumber,
        startTime: block.startTime,
        endTime: block.endTime,
        createdById: userByUniqueId.get('ADMIN001')!.id,
      })),
    ),
  });

  const joinCodeUpdatedAt = new Date();
  await prisma.club.createMany({
    data: CLUB_DEFINITIONS.map((club) => ({
      name: club.name,
      description: club.description,
      joinPolicy: club.joinPolicy,
      memberLimit: club.category === 'LEADERSHIP' ? 80 : club.category === 'PATHWAY' ? 60 : 40,
      joinCode: faker.string.alphanumeric({ length: 6, casing: 'upper' }),
      joinCodeUpdatedAt,
      isActive: true,
    })),
  });

  const clubRows = await prisma.club.findMany({
    select: { id: true, name: true, joinPolicy: true },
  });
  const clubByName = new Map(clubRows.map((club) => [club.name, club]));

  const studentDetails = studentSeeds.map((student) => ({
    ...student,
    id: userByUniqueId.get(student.uniqueId)!.id,
  }));
  const studentByUniqueId = new Map(studentDetails.map((student) => [student.uniqueId, student]));
  const membershipsByStudent = new Map<string, Set<string>>();
  const membersByClub = new Map<string, Set<string>>();
  for (const student of studentDetails) {
    membershipsByStudent.set(student.uniqueId, new Set());
  }
  for (const club of CLUB_DEFINITIONS) {
    membersByClub.set(club.name, new Set());
  }

  const canJoinClub = (student: StudentSeed, club: SeedClubDefinition) => {
    if (club.gradeLevels && !club.gradeLevels.includes(student.gradeLevel)) return false;
    return true;
  };

  const addMembership = (studentUniqueId: string, clubName: string) => {
    const studentMemberships = membershipsByStudent.get(studentUniqueId)!;
    if (studentMemberships.has(clubName) || studentMemberships.size >= 3) {
      return false;
    }
    studentMemberships.add(clubName);
    membersByClub.get(clubName)!.add(studentUniqueId);
    return true;
  };

  for (const student of studentDetails) {
    const matchingPathwayClubs = CLUB_DEFINITIONS.filter(
      (club) =>
        club.pathway === student.major &&
        canJoinClub(student, club),
    );
    const fallbackPathwayClubs = CLUB_DEFINITIONS.filter(
      (club) =>
        club.pathway === student.minor &&
        canJoinClub(student, club),
    );
    const primaryClub = faker.helpers.arrayElement(
      matchingPathwayClubs.length > 0 ? matchingPathwayClubs : fallbackPathwayClubs,
    );
    addMembership(student.uniqueId, primaryClub.name);

    const weightedExtras = [
      ...CLUB_DEFINITIONS.filter((club) => club.gradeLevels?.includes(student.gradeLevel)),
      ...CLUB_DEFINITIONS.filter((club) => club.category === 'ACADEMIC'),
      ...CLUB_DEFINITIONS.filter((club) => club.category === 'CREATIVE'),
      ...CLUB_DEFINITIONS.filter((club) => club.category === 'SERVICE'),
      ...CLUB_DEFINITIONS.filter((club) => club.pathway === student.minor),
      ...CLUB_DEFINITIONS.filter((club) => club.category === 'COMPETITIVE'),
    ].filter((club) => canJoinClub(student, club));

    const targetCount =
      1 +
      (faker.number.int({ min: 0, max: 99 }) < 78 ? 1 : 0) +
      (faker.number.int({ min: 0, max: 99 }) < 33 ? 1 : 0);

    let attempts = 0;
    while ((membershipsByStudent.get(student.uniqueId)!.size) < targetCount && attempts < 40) {
      attempts += 1;
      const nextClub = faker.helpers.arrayElement(weightedExtras);
      addMembership(student.uniqueId, nextClub.name);
    }
  }

  for (const club of CLUB_DEFINITIONS) {
    const minimumSize = club.category === 'LEADERSHIP' ? 18 : club.category === 'HONOR' ? 20 : 24;
    while (membersByClub.get(club.name)!.size < minimumSize) {
      const eligibleStudents = studentDetails.filter(
        (student) =>
          canJoinClub(student, club) &&
          !membershipsByStudent.get(student.uniqueId)!.has(club.name) &&
          membershipsByStudent.get(student.uniqueId)!.size < 3,
      );
      if (eligibleStudents.length === 0) break;
      const student = faker.helpers.arrayElement(eligibleStudents);
      addMembership(student.uniqueId, club.name);
    }
  }

  const leadershipTitlesByCategory: Record<SeedClubDefinition['category'], string[]> = {
    PATHWAY: ['President', 'Vice President', 'Project Lead'],
    ACADEMIC: ['President', 'Vice President'],
    LEADERSHIP: ['President', 'Vice President', 'Secretary', 'Treasurer'],
    CREATIVE: ['Editor', 'Producer', 'Creative Lead'],
    SERVICE: ['President', 'Outreach Lead', 'Operations Lead'],
    HONOR: ['President', 'Vice President', 'Secretary'],
    COMPETITIVE: ['Captain', 'Vice Captain', 'Logistics Lead'],
  };

  const clubMemberRows: Array<{ clubId: string; userId: string; role: string | null }> = [];
  const clubLeaderIds = new Map<string, string[]>();
  for (const club of CLUB_DEFINITIONS) {
    const memberUniqueIds = [...membersByClub.get(club.name)!];
    const rankedMembers = memberUniqueIds
      .map((uniqueId) => studentByUniqueId.get(uniqueId)!)
      .sort(
        (left, right) =>
          right.gradeLevel - left.gradeLevel || left.uniqueId.localeCompare(right.uniqueId),
      );
    const roleTitles = leadershipTitlesByCategory[club.category];
    const leaderCount = Math.min(roleTitles.length, rankedMembers.length);
    const leaderIds = rankedMembers.slice(0, leaderCount).map((student) => student.id);
    clubLeaderIds.set(club.name, leaderIds);

    const roleByUserId = new Map<string, string>();
    for (let index = 0; index < leaderCount; index += 1) {
      roleByUserId.set(rankedMembers[index]!.id, roleTitles[index]!);
    }

    for (const member of rankedMembers) {
      clubMemberRows.push({
        clubId: clubByName.get(club.name)!.id,
        userId: member.id,
        role: roleByUserId.get(member.id) ?? null,
      });
    }
  }
  for (const batch of chunkArray(clubMemberRows, 500)) {
    await prisma.clubMember.createMany({ data: batch });
  }

  const sponsorPool = normalizedStaffSeeds
    .filter((user) => user.roles.includes(Role.SPONSOR))
    .map((user) => user.uniqueId);
  const clubSponsorRows: Array<{ clubId: string; userId: string }> = [];
  CLUB_DEFINITIONS.forEach((club, index) => {
    const primarySponsor = sponsorPool[index % sponsorPool.length]!;
    const secondarySponsor = sponsorPool[(index + 9) % sponsorPool.length]!;
    const sponsorUniqueIds =
      club.category === 'LEADERSHIP' || club.category === 'HONOR'
        ? [primarySponsor, secondarySponsor]
        : [primarySponsor];

    for (const uniqueId of sponsorUniqueIds) {
      clubSponsorRows.push({
        clubId: clubByName.get(club.name)!.id,
        userId: userByUniqueId.get(uniqueId)!.id,
      });
    }
  });
  await prisma.clubSponsor.createMany({ data: clubSponsorRows });

  const clubChannelRows: Array<{
    clubId: string;
    name: string;
    description: string;
    visibility: ClubChannelVisibility;
    createdById: string;
  }> = [];
  for (const club of CLUB_DEFINITIONS) {
    const leaderId = clubLeaderIds.get(club.name)?.[0] ?? userByUniqueId.get('TCH001')!.id;
    for (const channel of buildChannelBlueprints(club)) {
      clubChannelRows.push({
        clubId: clubByName.get(club.name)!.id,
        name: channel.name,
        description: channel.description,
        visibility: channel.visibility,
        createdById: leaderId,
      });
    }
  }
  for (const batch of chunkArray(clubChannelRows, 200)) {
    await prisma.clubChannel.createMany({ data: batch });
  }

  const channelRows = await prisma.clubChannel.findMany({
    select: { id: true, clubId: true, name: true },
  });
  const channelsByClubId = new Map<string, typeof channelRows>();
  for (const channel of channelRows) {
    const existing = channelsByClubId.get(channel.clubId) ?? [];
    existing.push(channel);
    channelsByClubId.set(channel.clubId, existing);
  }

  const channelMembershipRows: Array<{ channelId: string; userId: string }> = [];
  for (const club of CLUB_DEFINITIONS) {
    const clubId = clubByName.get(club.name)!.id;
    const leaderIds = clubLeaderIds.get(club.name) ?? [];
    const memberIds = clubMemberRows
      .filter((member) => member.clubId === clubId)
      .map((member) => member.userId);

    for (const channel of channelsByClubId.get(clubId) ?? []) {
      if (channel.name !== 'officers') continue;

      const extraIds = faker.helpers.shuffle(
        memberIds.filter((memberId) => !leaderIds.includes(memberId)),
      ).slice(0, Math.min(6, Math.max(2, Math.floor(memberIds.length / 20))));

      for (const userId of [...leaderIds, ...extraIds]) {
        channelMembershipRows.push({ channelId: channel.id, userId });
      }
    }
  }
  if (channelMembershipRows.length > 0) {
    for (const batch of chunkArray(channelMembershipRows, 500)) {
      await prisma.clubChannelMembership.createMany({ data: batch });
    }
  }

  const requestClubRows = clubRows.filter((club) => club.joinPolicy === 'REQUEST');
  const joinRequestRows = requestClubRows.slice(0, 12).flatMap((club, index) => {
    const nonMembers = studentDetails.filter(
      (student) => !membersByClub.get(club.name)?.has(student.uniqueId),
    );
    const requesters = faker.helpers.shuffle(nonMembers).slice(0, index % 2 === 0 ? 2 : 1);
    return requesters.map((student) => ({
      clubId: club.id,
      requesterId: student.id,
      status: 'PENDING' as const,
    }));
  });
  if (joinRequestRows.length > 0) {
    await prisma.clubJoinRequest.createMany({ data: joinRequestRows });
  }

  console.log(`Clubs ready: ${clubRows.length}`);
  console.log(`Channels ready: ${channelRows.length}`);

  const scheduleRows = studentDetails.map((student) => ({
    userId: student.id,
    isPublic: faker.number.int({ min: 0, max: 99 }) < 68,
  }));
  for (const batch of chunkArray(scheduleRows, 250)) {
    await prisma.studentSchedule.createMany({ data: batch });
  }

  const schedules = await prisma.studentSchedule.findMany({
    select: { id: true, userId: true },
  });
  const scheduleIdByUserId = new Map(schedules.map((schedule) => [schedule.userId, schedule.id]));
  const scheduleEntryRows: Array<{
    scheduleId: string;
    courseId: string;
    className: string;
    weekday: ScheduleWeekday;
    periodNumber: number;
  }> = [];

  for (const student of studentDetails) {
    const scheduleId = scheduleIdByUserId.get(student.id)!;
    const courseSlugs = buildScheduleSlugs(student, courseBySlug);
    courseSlugs.forEach((slug, index) => {
      const course = courseBySlug.get(slug)!;
      WEEKDAYS.forEach((weekday) => {
        scheduleEntryRows.push({
          scheduleId,
          courseId: course.id,
          className: course.title,
          weekday,
          periodNumber: index + 1,
        });
      });
    });
  }
  for (const batch of chunkArray(scheduleEntryRows, 5000)) {
    await prisma.studentScheduleEntry.createMany({ data: batch });
  }

  const acceptedFriendPairs = chunkArray(studentDetails, 2)
    .slice(0, 180)
    .filter((pair) => pair.length === 2)
    .flatMap((pair) => [
      {
        requesterId: pair[0]!.id,
        addresseeId: pair[1]!.id,
        status: 'ACCEPTED' as const,
      },
      {
        requesterId: pair[1]!.id,
        addresseeId: pair[0]!.id,
        status: 'ACCEPTED' as const,
      },
    ]);
  await prisma.studentScheduleFriend.createMany({ data: acceptedFriendPairs });
  console.log(`Schedules ready: ${studentDetails.length}`);

  const allCurrentUsers = await prisma.user.findMany({ select: { id: true } });
  const sampleClub = clubByName.get('Robotics Club')!;
  const sampleChannel = channelRows.find(
    (channel) => channel.clubId === sampleClub.id && channel.name === 'general',
  );
  const sampleClubMemberIds = clubMemberRows
    .filter((member) => member.clubId === sampleClub.id)
    .map((member) => member.userId);

  await prisma.notificationPreference.createMany({
    data: allCurrentUsers.flatMap((user) => [
      {
        userId: user.id,
        category: NotificationCategory.SCHOOL_ANNOUNCEMENT,
        scopeKey: 'global',
        enabled: true,
        locked: true,
      },
      {
        userId: user.id,
        category: NotificationCategory.EVENT,
        scopeKey: 'global',
        enabled: true,
      },
      {
        userId: user.id,
        category: NotificationCategory.FLEX_FRIDAY,
        scopeKey: 'global',
        enabled: true,
      },
      {
        userId: user.id,
        category: NotificationCategory.CLUB_CHANNEL_MENTION,
        scopeKey: 'global',
        enabled: true,
      },
      ...(sampleChannel && sampleClubMemberIds.includes(user.id)
        ? [
            {
              userId: user.id,
              category: NotificationCategory.CLUB_ANNOUNCEMENT,
              clubId: sampleClub.id,
              scopeKey: `club:${sampleClub.id}`,
              enabled: true,
            },
            {
              userId: user.id,
              category: NotificationCategory.CLUB_CHANNEL_MENTION,
              clubId: sampleClub.id,
              channelId: sampleChannel.id,
              scopeKey: `channel:${sampleChannel.id}`,
              enabled: true,
            },
          ]
        : []),
    ]),
  });

  await prisma.keywordRule.createMany({
    data: [
      { keyword: 'violence', addedById: userByUniqueId.get('SUPER001')!.id },
      { keyword: 'weapon', addedById: userByUniqueId.get('SUPER001')!.id },
      { keyword: 'drugs', addedById: userByUniqueId.get('SUPER001')!.id },
    ],
  });

  const adminId = userByUniqueId.get('ADMIN001')!.id;
  const teacherId = userByUniqueId.get('TCH001')!.id;
  const roboticsLeaderId = clubLeaderIds.get('Robotics Club')?.[0] ?? studentByUniqueId.get('STU003')!.id;
  const now = new Date();
  const promotedUntil = new Date(now);
  promotedUntil.setMonth(promotedUntil.getMonth() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const announcements = [
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Welcome to IA School App',
      body: 'This is the official school communication platform for schedules, clubs, events, and announcements across Innovation Academy.',
      targetType: AnnouncementTarget.SCHOOL_WIDE,
      isAdminGeneral: true,
      allowComments: false,
      status: AnnouncementStatus.ACTIVE,
      promotedUntil,
    },
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: now,
      title: 'April Flex Friday Registration Opens Monday',
      body: 'Registration opens Monday at 8:00 AM in the events portal. Reserve workshop seats early so you can stay on pace for annual Flex Friday credits.',
      targetType: AnnouncementTarget.SCHOOL_WIDE,
      isAdminGeneral: true,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Innovation Showcase Night This Thursday',
      body: 'Families and partners are invited to walk project galleries, see pathway demos, and meet student teams across every grade level.',
      targetType: AnnouncementTarget.SCHOOL_WIDE,
      isAdminGeneral: true,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
      expiresAt: nextWeek,
    },
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Freshman GT Block Pathway Showcase',
      body: 'Ninth graders will rotate through Health Science, Engineering, and IT labs during next week’s GT Block showcase. Bring your lanyard and Chromebook.',
      targetType: AnnouncementTarget.GRADE,
      targetGrade: 9,
      targetGrades: [9],
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Junior Pinnacle Proposal Window Opens',
      body: 'Students preparing for junior research should submit proposal drafts before advisory next Wednesday so mentors can review placement needs.',
      targetType: AnnouncementTarget.GRADE,
      targetGrade: 11,
      targetGrades: [11, 12],
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: adminId,
      approvedAt: now,
      title: 'AI Track Interest Meeting for IT Students',
      body: 'Information Technology students interested in the AI sequence should join the after-school interest meeting in Lab 214 to review sequencing and project expectations.',
      targetType: AnnouncementTarget.PATHWAY,
      targetPathway: Pathway.INFORMATION_TECHNOLOGY,
      targetMajorPathways: [Pathway.INFORMATION_TECHNOLOGY],
      targetMinorPathways: [Pathway.INFORMATION_TECHNOLOGY],
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Engineering Fabrication Safety Refresh',
      body: 'Engineering students using fabrication spaces this month need to complete the updated safety check before machine sign-off can be renewed.',
      targetType: AnnouncementTarget.PATHWAY,
      targetPathway: Pathway.ENGINEERING,
      targetMajorPathways: [Pathway.ENGINEERING],
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: adminId,
      approvedAt: now,
      title: 'Health Science Simulation Lab Signups',
      body: 'Simulation lab stations for clinical-skills practice are open this week. Review the posted procedure rubric before choosing a session block.',
      targetType: AnnouncementTarget.PATHWAY,
      targetPathway: Pathway.HEALTH_SCIENCE,
      targetMajorPathways: [Pathway.HEALTH_SCIENCE],
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: teacherId,
      approvedAt: now,
      title: 'Robotics Club Scrimmage Build Saturday',
      body: 'Robotics Club will run a Saturday build and driver practice session in the fabrication lab. Wear closed-toe shoes and check the officers channel for the task board.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('Robotics Club')!.id,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
      promotedUntil,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: teacherId,
      approvedAt: now,
      title: 'HOSA Clinical Skills Workshop Sign-Up',
      body: 'HOSA members can sign up for the after-school clinical skills workshop focused on patient assessment and EMT scenarios. Space is limited to the first 20 registrations.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('HOSA')!.id,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: teacherId,
      approvedAt: now,
      title: 'CyberPatriot Practice Image Released',
      body: 'The new practice image is posted in the competition-prep channel. Teams should complete first-pass hardening before Wednesday review.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('CyberPatriot')!.id,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: teacherId,
      submittedById: teacherId,
      approvedById: teacherId,
      approvedAt: now,
      title: 'IA Beacon Story Pitch Round',
      body: 'Beacon writers should submit one profile idea and one campus-news idea before Friday so the editorial board can lock next issue assignments.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('IA Beacon')!.id,
      allowComments: true,
      status: AnnouncementStatus.ACTIVE,
    },
    {
      authorId: roboticsLeaderId,
      submittedById: roboticsLeaderId,
      title: 'Robotics fundraiser announcement draft',
      body: 'Student leaders drafted this update for sponsor approval. It should appear in the sponsor review queue before it is published.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('Robotics Club')!.id,
      allowComments: true,
      status: AnnouncementStatus.PENDING_APPROVAL,
    },
    {
      authorId: roboticsLeaderId,
      submittedById: roboticsLeaderId,
      approvedById: teacherId,
      title: 'Rejected robotics travel note',
      body: 'This seeded proposal demonstrates rejected copy and sponsor feedback.',
      targetType: AnnouncementTarget.CLUB,
      clubId: clubByName.get('Robotics Club')!.id,
      allowComments: false,
      status: AnnouncementStatus.REJECTED,
      rejectionNote: 'Please confirm the travel date and remove unapproved cost language.',
    },
    {
      authorId: adminId,
      submittedById: adminId,
      approvedById: adminId,
      approvedAt: lastWeek,
      title: 'Expired parking reminder',
      body: 'This announcement is intentionally expired so archive and expired filters have seeded data.',
      targetType: AnnouncementTarget.SCHOOL_WIDE,
      allowComments: false,
      status: AnnouncementStatus.EXPIRED,
      expiresAt: lastWeek,
    },
  ];
  await prisma.announcement.createMany({ data: announcements });
  const seededAnnouncements = await prisma.announcement.findMany({
    select: { id: true, title: true },
  });
  const announcementIdByTitle = new Map(seededAnnouncements.map((announcement) => [announcement.title, announcement.id]));
  await prisma.announcementBookmark.createMany({
    data: [
      {
        announcementId: announcementIdByTitle.get('Welcome to IA School App')!,
        userId: studentByUniqueId.get('STU001')!.id,
      },
      {
        announcementId: announcementIdByTitle.get('Robotics Club Scrimmage Build Saturday')!,
        userId: studentByUniqueId.get('STU003')!.id,
      },
      {
        announcementId: announcementIdByTitle.get('Innovation Showcase Night This Thursday')!,
        userId: userByUniqueId.get('TCH001')!.id,
      },
    ],
  });
  console.log(`Announcements ready: ${announcements.length}`);

  if (sampleChannel) {
    const pollOptions = [
      { id: 'tuesday', label: 'Tuesday after school' },
      { id: 'thursday', label: 'Thursday after school' },
      { id: 'saturday', label: 'Saturday morning' },
    ];
    const pinnedMessage = await prisma.clubChannelMessage.create({
      data: {
        channelId: sampleChannel.id,
        authorId: teacherId,
        body: 'Pinned build checklist: charge batteries, confirm drive team, and bring safety glasses.',
        isPinned: true,
        pinnedAt: now,
      },
    });
    const pollMessage = await prisma.clubChannelMessage.create({
      data: {
        channelId: sampleChannel.id,
        authorId: roboticsLeaderId,
        body: 'Vote for the next drive practice. You can use **markdown**, tables, and math like $v = d/t$ in chat.',
        pollQuestion: 'When should we hold drive practice?',
        pollOptions,
      },
    });
    await prisma.clubChannelMessagePollVote.createMany({
      data: sampleClubMemberIds.slice(0, 18).map((userId, index) => ({
        messageId: pollMessage.id,
        userId,
        optionId: pollOptions[index % pollOptions.length]!.id,
      })),
    });
    await prisma.clubChannelMessageAttachment.create({
      data: {
        messageId: pinnedMessage.id,
        fileName: 'build-checklist.pdf',
        fileUrl: '/uploads/seed/build-checklist.pdf',
        mimeType: 'application/pdf',
        size: 128000,
      },
    });
    console.log('Channel messages ready: pinned message, markdown poll, and attachment sample');
  }

  console.log('');
  console.log('Seeding complete.');
  console.log('Default credentials use each account uniqueId as the password.');
  console.log('Anchor accounts: SUPER001, ADMIN001, TCH001, STU001-STU010.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

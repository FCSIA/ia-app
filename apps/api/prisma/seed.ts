import { AnnouncementTarget, Pathway, PrismaClient, Role, ScheduleWeekday } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetPassword(uniqueId: string) {
  return bcrypt.hash(uniqueId, 12);
}

async function ensureAnnouncement({
  title,
  body,
  authorId,
  targetType,
  allowComments = false,
  isAdminGeneral = false,
  targetGrade,
  targetPathway,
  clubId,
}: {
  title: string;
  body: string;
  authorId: string;
  targetType: AnnouncementTarget;
  allowComments?: boolean;
  isAdminGeneral?: boolean;
  targetGrade?: number;
  targetPathway?: Pathway;
  clubId?: string;
}) {
  const existing = await prisma.announcement.findFirst({ where: { title } });

  if (existing) {
    return prisma.announcement.update({
      where: { id: existing.id },
      data: {
        body,
        authorId,
        targetType,
        allowComments,
        isAdminGeneral,
        targetGrade,
        targetPathway,
        clubId,
        status: 'ACTIVE',
      },
    });
  }

  return prisma.announcement.create({
    data: {
      title,
      body,
      authorId,
      targetType,
      allowComments,
      isAdminGeneral,
      targetGrade,
      targetPathway,
      clubId,
    },
  });
}

async function main() {
  console.log('Seeding database...');

  const superAdminHash = await resetPassword('SUPER001');
  const superAdmin = await prisma.user.upsert({
    where: { uniqueId: 'SUPER001' },
    update: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@ia.school',
      passwordHash: superAdminHash,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
    create: {
      uniqueId: 'SUPER001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@ia.school',
      passwordHash: superAdminHash,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
  });
  console.log('Super Admin ready:', superAdmin.uniqueId);

  const adminHash = await resetPassword('ADMIN001');
  const admin = await prisma.user.upsert({
    where: { uniqueId: 'ADMIN001' },
    update: {
      firstName: 'School',
      lastName: 'Admin',
      email: 'admin@ia.school',
      passwordHash: adminHash,
      roles: [Role.ADMIN],
    },
    create: {
      uniqueId: 'ADMIN001',
      firstName: 'School',
      lastName: 'Admin',
      email: 'admin@ia.school',
      passwordHash: adminHash,
      roles: [Role.ADMIN],
    },
  });

  const teacherHash = await resetPassword('TCH001');
  const teacher = await prisma.user.upsert({
    where: { uniqueId: 'TCH001' },
    update: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jsmith@ia.school',
      passwordHash: teacherHash,
      roles: [Role.TEACHER, Role.SPONSOR],
    },
    create: {
      uniqueId: 'TCH001',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jsmith@ia.school',
      passwordHash: teacherHash,
      roles: [Role.TEACHER, Role.SPONSOR],
    },
  });

  const studentData = [
    {
      uniqueId: 'STU001',
      firstName: 'Alex',
      lastName: 'Johnson',
      gradeLevel: 9,
      major: Pathway.INFORMATION_TECHNOLOGY,
      minor: Pathway.ENGINEERING,
    },
    {
      uniqueId: 'STU002',
      firstName: 'Sam',
      lastName: 'Lee',
      gradeLevel: 10,
      major: Pathway.HEALTH_SCIENCE,
      minor: Pathway.INFORMATION_TECHNOLOGY,
    },
    {
      uniqueId: 'STU003',
      firstName: 'Jordan',
      lastName: 'Park',
      gradeLevel: 11,
      major: Pathway.ENGINEERING,
      minor: Pathway.INFORMATION_TECHNOLOGY,
    },
    {
      uniqueId: 'STU004',
      firstName: 'Taylor',
      lastName: 'Kim',
      gradeLevel: 12,
      major: Pathway.INFORMATION_TECHNOLOGY,
      minor: Pathway.HEALTH_SCIENCE,
    },
    {
      uniqueId: 'STU005',
      firstName: 'Morgan',
      lastName: 'Patel',
      gradeLevel: 9,
      major: Pathway.ENGINEERING,
      minor: Pathway.INFORMATION_TECHNOLOGY,
    },
    {
      uniqueId: 'STU006',
      firstName: 'Riley',
      lastName: 'Nguyen',
      gradeLevel: 10,
      major: Pathway.INFORMATION_TECHNOLOGY,
      minor: Pathway.ENGINEERING,
    },
    {
      uniqueId: 'STU007',
      firstName: 'Casey',
      lastName: 'Brooks',
      gradeLevel: 11,
      major: Pathway.HEALTH_SCIENCE,
      minor: Pathway.ENGINEERING,
    },
    {
      uniqueId: 'STU008',
      firstName: 'Avery',
      lastName: 'Rivera',
      gradeLevel: 12,
      major: Pathway.ENGINEERING,
      minor: Pathway.HEALTH_SCIENCE,
    },
    {
      uniqueId: 'STU009',
      firstName: 'Quinn',
      lastName: 'Carter',
      gradeLevel: 10,
      major: Pathway.INFORMATION_TECHNOLOGY,
      minor: Pathway.HEALTH_SCIENCE,
    },
    {
      uniqueId: 'STU010',
      firstName: 'Jamie',
      lastName: 'Flores',
      gradeLevel: 11,
      major: Pathway.HEALTH_SCIENCE,
      minor: Pathway.INFORMATION_TECHNOLOGY,
    },
  ];

  const studentsByUniqueId = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const studentDataEntry of studentData) {
    const student = await prisma.user.upsert({
      where: { uniqueId: studentDataEntry.uniqueId },
      update: {
        firstName: studentDataEntry.firstName,
        lastName: studentDataEntry.lastName,
        gradeLevel: studentDataEntry.gradeLevel,
        major: studentDataEntry.major,
        minor: studentDataEntry.minor,
        passwordHash: await resetPassword(studentDataEntry.uniqueId),
        roles: [Role.STUDENT],
        isActive: true,
      },
      create: {
        ...studentDataEntry,
        passwordHash: await resetPassword(studentDataEntry.uniqueId),
        roles: [Role.STUDENT],
      },
    });

    studentsByUniqueId.set(student.uniqueId, student);
  }
  console.log(`Students ready: ${studentsByUniqueId.size}`);

  const clubDefinitions = [
    {
      name: 'Robotics Club',
      description: 'Build competition robots, test autonomous routines, and prep for regional scrimmages.',
      memberRoles: [
        { uniqueId: 'STU001', role: 'LEADER' },
        { uniqueId: 'STU003', role: 'LEADER' },
        { uniqueId: 'STU005', role: null },
        { uniqueId: 'STU008', role: null },
      ],
      channels: [
        { name: 'general', description: 'General robotics discussion.', isPrivate: false, createdBy: 'STU001' },
        { name: 'officers', description: 'Leadership coordination and event planning.', isPrivate: true, createdBy: 'STU003' },
      ],
    },
    {
      name: 'Girls Who Code',
      description: 'Peer-led coding workshops, portfolio builds, and hackathon prep.',
      memberRoles: [
        { uniqueId: 'STU004', role: 'LEADER' },
        { uniqueId: 'STU006', role: null },
        { uniqueId: 'STU009', role: null },
      ],
      channels: [
        { name: 'general', description: 'Coding resources and practice prompts.', isPrivate: false, createdBy: 'STU004' },
        { name: 'hackathon-planning', description: 'Competition prep and team formation.', isPrivate: false, createdBy: 'STU004' },
      ],
    },
    {
      name: 'HOSA',
      description: 'Healthcare competition prep, clinical skills practice, and service projects.',
      memberRoles: [
        { uniqueId: 'STU002', role: 'LEADER' },
        { uniqueId: 'STU007', role: 'LEADER' },
        { uniqueId: 'STU010', role: null },
      ],
      channels: [
        { name: 'general', description: 'Competition updates and practice schedules.', isPrivate: false, createdBy: 'STU002' },
        { name: 'officers', description: 'Leadership logistics for HOSA events.', isPrivate: true, createdBy: 'STU007' },
      ],
    },
    {
      name: 'Science Olympiad',
      description: 'Prepare for build and study events across engineering, biology, and chemistry.',
      memberRoles: [
        { uniqueId: 'STU003', role: 'LEADER' },
        { uniqueId: 'STU007', role: null },
        { uniqueId: 'STU009', role: null },
      ],
      channels: [
        { name: 'general', description: 'Event updates and shared prep materials.', isPrivate: false, createdBy: 'STU003' },
        { name: 'build-events', description: 'Bridge, tower, and prototype build coordination.', isPrivate: false, createdBy: 'STU003' },
      ],
    },
    {
      name: 'Math Team',
      description: 'Weekly problem solving, AMC prep, and peer tutoring for competition math.',
      memberRoles: [
        { uniqueId: 'STU006', role: 'LEADER' },
        { uniqueId: 'STU008', role: null },
        { uniqueId: 'STU010', role: null },
      ],
      channels: [
        { name: 'general', description: 'Practice sets and meeting reminders.', isPrivate: false, createdBy: 'STU006' },
        { name: 'contest-prep', description: 'Scrimmage rosters and solution writeups.', isPrivate: false, createdBy: 'STU006' },
      ],
    },
    {
      name: 'Quiz Bowl',
      description: 'Fast-paced academic team for tossup and bonus practice across all subjects.',
      memberRoles: [
        { uniqueId: 'STU001', role: null },
        { uniqueId: 'STU004', role: 'LEADER' },
        { uniqueId: 'STU005', role: null },
        { uniqueId: 'STU009', role: null },
      ],
      channels: [
        { name: 'general', description: 'Practice schedules and packet links.', isPrivate: false, createdBy: 'STU004' },
        { name: 'captains', description: 'Captain planning and lineup decisions.', isPrivate: true, createdBy: 'STU004' },
      ],
    },
  ];

  const clubsByName = new Map<string, Awaited<ReturnType<typeof prisma.club.upsert>>>();
  for (const clubDefinition of clubDefinitions) {
    const club = await prisma.club.upsert({
      where: { name: clubDefinition.name },
      update: {
        description: clubDefinition.description,
        isActive: true,
      },
      create: {
        name: clubDefinition.name,
        description: clubDefinition.description,
      },
    });

    clubsByName.set(club.name, club);

    await prisma.clubSponsor.createMany({
      data: [{ clubId: club.id, userId: teacher.id }],
      skipDuplicates: true,
    });

    await prisma.clubMember.createMany({
      data: clubDefinition.memberRoles.map((member) => ({
        clubId: club.id,
        userId: studentsByUniqueId.get(member.uniqueId)!.id,
        role: member.role ?? undefined,
      })),
      skipDuplicates: true,
    });

    for (const member of clubDefinition.memberRoles) {
      await prisma.clubMember.update({
        where: {
          clubId_userId: {
            clubId: club.id,
            userId: studentsByUniqueId.get(member.uniqueId)!.id,
          },
        },
        data: { role: member.role ?? null },
      });
    }

    await prisma.clubChannel.createMany({
      data: clubDefinition.channels.map((channel) => ({
        clubId: club.id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        createdById: studentsByUniqueId.get(channel.createdBy)!.id,
      })),
      skipDuplicates: true,
    });

    for (const channel of clubDefinition.channels) {
      await prisma.clubChannel.update({
        where: {
          clubId_name: {
            clubId: club.id,
            name: channel.name,
          },
        },
        data: {
          description: channel.description,
          isPrivate: channel.isPrivate,
          createdById: studentsByUniqueId.get(channel.createdBy)!.id,
        },
      });
    }
  }
  console.log(`Clubs ready: ${clubsByName.size}`);

  await prisma.schoolDayBlock.deleteMany();

  const weekdays = [
    ScheduleWeekday.MONDAY,
    ScheduleWeekday.TUESDAY,
    ScheduleWeekday.WEDNESDAY,
    ScheduleWeekday.THURSDAY,
    ScheduleWeekday.FRIDAY,
  ];

  const baseBlocks = [
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

  await prisma.schoolDayBlock.createMany({
    data: weekdays.flatMap((weekday) =>
      baseBlocks.map((block) => ({
        weekday,
        label: block.label,
        periodNumber: block.periodNumber,
        startTime: block.startTime,
        endTime: block.endTime,
        createdById: admin.id,
      })),
    ),
  });
  console.log('School day blocks ready');

  const alexSchedule = await prisma.studentSchedule.upsert({
    where: { userId: studentsByUniqueId.get('STU001')!.id },
    update: { isPublic: true },
    create: {
      userId: studentsByUniqueId.get('STU001')!.id,
      isPublic: true,
    },
  });

  const jordanSchedule = await prisma.studentSchedule.upsert({
    where: { userId: studentsByUniqueId.get('STU003')!.id },
    update: { isPublic: true },
    create: {
      userId: studentsByUniqueId.get('STU003')!.id,
      isPublic: true,
    },
  });

  await prisma.studentScheduleEntry.deleteMany({
    where: { scheduleId: { in: [alexSchedule.id, jordanSchedule.id] } },
  });

  await prisma.studentScheduleEntry.createMany({
    data: weekdays.flatMap((weekday) => [
      { scheduleId: alexSchedule.id, weekday, periodNumber: 1, className: 'English I' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 2, className: 'Algebra I' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 3, className: 'Biology' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 4, className: 'World History' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 5, className: 'Robotics Lab' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 6, className: 'Spanish I' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 7, className: 'Health' },
      { scheduleId: alexSchedule.id, weekday, periodNumber: 8, className: 'Study Hall' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 1, className: 'AP Literature' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 2, className: 'Engineering Design' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 3, className: 'Physics' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 4, className: 'US History' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 5, className: 'Leadership Seminar' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 6, className: 'Calculus' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 7, className: 'Computer Science' },
      { scheduleId: jordanSchedule.id, weekday, periodNumber: 8, className: 'Capstone' },
    ]),
  });

  await prisma.studentScheduleFriend.createMany({
    data: [
      { requesterId: studentsByUniqueId.get('STU001')!.id, addresseeId: studentsByUniqueId.get('STU003')!.id, status: 'ACCEPTED' },
      { requesterId: studentsByUniqueId.get('STU003')!.id, addresseeId: studentsByUniqueId.get('STU001')!.id, status: 'ACCEPTED' },
      { requesterId: studentsByUniqueId.get('STU004')!.id, addresseeId: studentsByUniqueId.get('STU006')!.id, status: 'ACCEPTED' },
      { requesterId: studentsByUniqueId.get('STU006')!.id, addresseeId: studentsByUniqueId.get('STU004')!.id, status: 'ACCEPTED' },
    ],
    skipDuplicates: true,
  });
  console.log('Sample schedules ready');

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const prefRecords = allUsers.flatMap((user) => [
    { userId: user.id, category: 'SCHOOL_ANNOUNCEMENT' as const, enabled: true },
    { userId: user.id, category: 'EVENT' as const, enabled: true },
    { userId: user.id, category: 'FLEX_FRIDAY' as const, enabled: true },
  ]);
  await prisma.notificationPreference.createMany({
    data: prefRecords,
    skipDuplicates: true,
  });
  console.log(`Bootstrapped preferences for ${allUsers.length} users`);

  await prisma.keywordRule.createMany({
    data: [
      { keyword: 'violence', addedById: superAdmin.id },
      { keyword: 'weapon', addedById: superAdmin.id },
      { keyword: 'drugs', addedById: superAdmin.id },
    ],
    skipDuplicates: true,
  });

  await ensureAnnouncement({
    authorId: admin.id,
    title: 'Welcome to IA School App',
    body: 'This is the official school communication platform. Stay informed about school events, clubs, and Flex Fridays.',
    targetType: 'SCHOOL_WIDE',
    isAdminGeneral: true,
    allowComments: false,
  });

  await ensureAnnouncement({
    authorId: admin.id,
    title: 'April Flex Friday Registration Opens Monday',
    body: 'Registration opens Monday at 8:00 AM in the IA Events portal. Students need 12 Flex Friday credits each school year, so reserve your workshop early.',
    targetType: 'SCHOOL_WIDE',
    isAdminGeneral: true,
    allowComments: true,
  });

  await ensureAnnouncement({
    authorId: admin.id,
    title: 'Freshman GT Block Pathway Showcase',
    body: 'Ninth graders will rotate through Health Science, Engineering, and IT labs during next week’s GT Block showcase. Bring your lanyard and Chromebook.',
    targetType: 'GRADE',
    targetGrade: 9,
    allowComments: true,
  });

  await ensureAnnouncement({
    authorId: teacher.id,
    title: 'AI Track Interest Meeting for IT Students',
    body: 'Information Technology students interested in the new AI track should join the interest meeting after school in Lab 214. We will cover pathway sequencing and project expectations.',
    targetType: 'PATHWAY',
    targetPathway: Pathway.INFORMATION_TECHNOLOGY,
    allowComments: true,
  });

  await ensureAnnouncement({
    authorId: teacher.id,
    title: 'Robotics Club Scrimmage Build Saturday',
    body: 'Robotics Club will run a Saturday build and driver practice session in the fabrication lab. Wear closed-toe shoes and check the officers channel for the task board.',
    targetType: 'CLUB',
    clubId: clubsByName.get('Robotics Club')!.id,
    allowComments: true,
  });

  await ensureAnnouncement({
    authorId: teacher.id,
    title: 'HOSA Clinical Skills Workshop Sign-Up',
    body: 'HOSA members can sign up for the after-school clinical skills workshop focused on patient assessment and EMT scenarios. Space is limited to the first 20 registrations.',
    targetType: 'CLUB',
    clubId: clubsByName.get('HOSA')!.id,
    allowComments: true,
  });
  console.log('Announcements ready: 6');

  console.log('\nSeeding complete!');
  console.log('\nDefault credentials (password = uniqueId):');
  console.log('  SUPER001  ->  Super Admin');
  console.log('  ADMIN001  ->  Admin');
  console.log('  TCH001    ->  Teacher / Sponsor');
  console.log('  STU001-STU010  ->  Students');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient, Role, Pathway, ScheduleWeekday } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Super Admin (update: includes passwordHash so re-seeding resets passwords)
  const superAdminHash = await bcrypt.hash('SUPER001', 12);
  const superAdmin = await prisma.user.upsert({
    where: { uniqueId: 'SUPER001' },
    update: { passwordHash: superAdminHash },
    create: {
      uniqueId: 'SUPER001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@ia.school',
      passwordHash: superAdminHash,
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
    },
  });
  console.log('Super Admin created:', superAdmin.uniqueId);

  // Create Admin
  const adminHash = await bcrypt.hash('ADMIN001', 12);
  const admin = await prisma.user.upsert({
    where: { uniqueId: 'ADMIN001' },
    update: { passwordHash: adminHash },
    create: {
      uniqueId: 'ADMIN001',
      firstName: 'School',
      lastName: 'Admin',
      email: 'admin@ia.school',
      passwordHash: adminHash,
      roles: [Role.ADMIN],
    },
  });

  // Create a Teacher / Sponsor
  const teacherHash = await bcrypt.hash('TCH001', 12);
  const teacher = await prisma.user.upsert({
    where: { uniqueId: 'TCH001' },
    update: { passwordHash: teacherHash },
    create: {
      uniqueId: 'TCH001',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jsmith@ia.school',
      passwordHash: teacherHash,
      roles: [Role.TEACHER],
    },
  });

  // Create sample students (password = uniqueId)
  const studentData = [
    { uniqueId: 'STU001', firstName: 'Alex', lastName: 'Johnson', gradeLevel: 9, major: Pathway.INFORMATION_TECHNOLOGY },
    { uniqueId: 'STU002', firstName: 'Sam', lastName: 'Lee', gradeLevel: 10, major: Pathway.HEALTH_SCIENCE },
    { uniqueId: 'STU003', firstName: 'Jordan', lastName: 'Park', gradeLevel: 11, major: Pathway.ENGINEERING },
    { uniqueId: 'STU004', firstName: 'Taylor', lastName: 'Kim', gradeLevel: 12, major: Pathway.INFORMATION_TECHNOLOGY },
  ];

  const createdStudents = [];
  for (const s of studentData) {
    const student = await prisma.user.upsert({
      where: { uniqueId: s.uniqueId },
      update: {
        gradeLevel: s.gradeLevel,
        major: s.major,
      },
      create: {
        ...s,
        passwordHash: await bcrypt.hash(s.uniqueId, 12),
        roles: [Role.STUDENT],
      },
    });
    createdStudents.push(student);
  }

  // Keep school-wide student roles simple; club-specific titles live on memberships.
  await prisma.user.update({
    where: { uniqueId: 'STU003' },
    data: { roles: [Role.STUDENT] },
  });
  await prisma.user.update({
    where: { uniqueId: 'STU004' },
    data: { roles: [Role.STUDENT] },
  });

  // Create a Club (upsert by name)
  const existingClub = await prisma.club.findFirst({ where: { name: 'Robotics Club' } });
  const club = existingClub ?? await prisma.club.create({
    data: {
      id: 'robotics',
      name: 'Robotics Club',
      description: 'Building robots and competing in regional events.',
      sponsors: { create: [{ userId: teacher.id }] },
      members: {
        create: [
          { userId: createdStudents[0].id, role: 'President' },
          { userId: createdStudents[1].id },
        ],
      },
      channels: {
        create: [
          { id: 'general', name: 'general', description: 'General robotics discussion.', createdById: createdStudents[0].id },
          { id: 'officers', name: 'officers', description: 'Leadership coordination.', isPrivate: true, createdById: createdStudents[0].id },
        ],
      },
    },
  });
  console.log('Club ready:', club.name);

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
    where: { userId: createdStudents[0].id },
    update: { isPublic: true },
    create: {
      userId: createdStudents[0].id,
      isPublic: true,
    },
  });

  const jordanSchedule = await prisma.studentSchedule.upsert({
    where: { userId: createdStudents[2].id },
    update: { isPublic: true },
    create: {
      userId: createdStudents[2].id,
      isPublic: true,
    },
  });

  await prisma.studentScheduleEntry.deleteMany({
    where: { scheduleId: { in: [alexSchedule.id, jordanSchedule.id] } },
  });

  const scheduleWeekdays = weekdays;

  await prisma.studentScheduleEntry.createMany({
    data: scheduleWeekdays.flatMap((weekday) => [
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
      { ownerId: createdStudents[0].id, friendId: createdStudents[2].id },
      { ownerId: createdStudents[2].id, friendId: createdStudents[0].id },
    ],
    skipDuplicates: true,
  });
  console.log('Sample schedules ready');

  // Bootstrap notification preferences for all users using createMany + skipDuplicates
  // (avoids upsert null-in-composite-key issue with Prisma 6)
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const prefRecords = allUsers.flatMap((u) => [
    { userId: u.id, category: 'SCHOOL_ANNOUNCEMENT' as const, enabled: true },
    { userId: u.id, category: 'EVENT' as const, enabled: true },
    { userId: u.id, category: 'FLEX_FRIDAY' as const, enabled: true },
  ]);
  await prisma.notificationPreference.createMany({
    data: prefRecords,
    skipDuplicates: true,
  });
  console.log(`Bootstrapped preferences for ${allUsers.length} users`);

  // Sample keyword rules
  await prisma.keywordRule.createMany({
    data: [
      { keyword: 'violence', addedById: superAdmin.id },
      { keyword: 'weapon', addedById: superAdmin.id },
      { keyword: 'drugs', addedById: superAdmin.id },
    ],
    skipDuplicates: true,
  });

  // Sample announcement (only if none exist)
  const existingAnn = await prisma.announcement.findFirst();
  if (!existingAnn) {
    await prisma.announcement.create({
      data: {
        authorId: admin.id,
        title: 'Welcome to IA School App',
        body: 'This is the official school communication platform. Stay informed about school events, clubs, and Flex Fridays!',
        targetType: 'SCHOOL_WIDE',
        isAdminGeneral: true,
        allowComments: false,
      },
    });
    console.log('Sample announcement created');
  }

  console.log('\nSeeding complete!');
  console.log('\nDefault credentials (password = uniqueId):');
  console.log('  SUPER001  →  Super Admin');
  console.log('  ADMIN001  →  Admin');
  console.log('  TCH001    →  Teacher / Sponsor');
  console.log('  STU001–STU004  →  Students');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

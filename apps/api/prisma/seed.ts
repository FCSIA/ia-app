import { PrismaClient, Role } from '@prisma/client';
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
      role: 'SUPER_ADMIN',
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
      role: 'ADMIN',
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
      role: 'TEACHER',
    },
  });

  // Create sample students (password = uniqueId)
  const studentData = [
    { uniqueId: 'STU001', firstName: 'Alex', lastName: 'Johnson', gradeLevel: '9', pathway: 'STEM' },
    { uniqueId: 'STU002', firstName: 'Sam', lastName: 'Lee', gradeLevel: '10', pathway: 'Arts' },
    { uniqueId: 'STU003', firstName: 'Jordan', lastName: 'Park', gradeLevel: '11', pathway: 'Business' },
    { uniqueId: 'STU004', firstName: 'Taylor', lastName: 'Kim', gradeLevel: '12', pathway: 'STEM' },
  ];

  const createdStudents = [];
  for (const s of studentData) {
    const student = await prisma.user.upsert({
      where: { uniqueId: s.uniqueId },
      update: {},
      create: {
        ...s,
        passwordHash: await bcrypt.hash(s.uniqueId, 12),
        role: 'STUDENT',
      },
    });
    createdStudents.push(student);
  }

  // Promote STU003 to Student Leader, STU004 to Student Admin
  await prisma.user.update({
    where: { uniqueId: 'STU003' },
    data: { role: 'STUDENT_LEADER' },
  });
  await prisma.user.update({
    where: { uniqueId: 'STU004' },
    data: { role: 'STUDENT_ADMIN' },
  });

  // Create a Club (upsert by name)
  const existingClub = await prisma.club.findFirst({ where: { name: 'Robotics Club' } });
  const club = existingClub ?? await prisma.club.create({
    data: {
      name: 'Robotics Club',
      description: 'Building robots and competing in regional events.',
      sponsors: { create: [{ userId: teacher.id }] },
      members: {
        create: [
          { userId: createdStudents[0].id, role: 'LEADER' },
          { userId: createdStudents[1].id, role: 'MEMBER' },
        ],
      },
    },
  });
  console.log('Club ready:', club.name);

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
  });
  console.log(`Bootstrapped preferences for ${allUsers.length} users`);

  // Sample keyword rules
  await prisma.keywordRule.createMany({
    data: [
      { keyword: 'violence', addedById: superAdmin.id },
      { keyword: 'weapon', addedById: superAdmin.id },
      { keyword: 'drugs', addedById: superAdmin.id },
    ],
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

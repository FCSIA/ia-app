import { describe, expect, it } from 'vitest';
import type { CourseSummary } from '@/components/courses/types';
import { parseInfiniteCampusSchedule } from './schedule-ocr';

const courses = [
  {
    id: 'chemistry' as CourseSummary['id'],
    slug: 'chemistry',
    title: 'Chemistry',
    department: 'Science',
    courseNumbers: ['CHM101'],
    pathway: null,
    catalogSource: 'COURSE_CATALOG',
    term: 'YEAR',
    gradeText: '10',
    minGrade: 10,
    maxGrade: 10,
  },
  {
    id: 'economics' as CourseSummary['id'],
    slug: 'economics',
    title: 'Economics',
    department: 'Social Studies',
    courseNumbers: ['ECO201'],
    pathway: null,
    catalogSource: 'COURSE_CATALOG',
    term: 'YEAR',
    gradeText: '11',
    minGrade: 11,
    maxGrade: 11,
  },
] satisfies CourseSummary[];

describe('parseInfiniteCampusSchedule', () => {
  it('pairs labeled periods with courses and ignores room details', () => {
    const rows = parseInfiniteCampusSchedule(
      'Period 1 Chemistry\nRoom 101\nPeriod 2 Economics',
      courses,
    );

    expect(rows).toMatchObject([
      { periodNumber: 1, matchedCourse: { id: 'chemistry' } },
      { periodNumber: 2, matchedCourse: { id: 'economics' } },
    ]);
  });

  it('builds a reviewable sequential fallback for an unlabeled course list', () => {
    const rows = parseInfiniteCampusSchedule('chem\necon', courses);

    expect(rows).toMatchObject([
      { periodNumber: 1, matchedCourse: { id: 'chemistry' } },
      { periodNumber: 2, matchedCourse: { id: 'economics' } },
    ]);
  });

  it('keeps unmatched labeled text for manual review', () => {
    const rows = parseInfiniteCampusSchedule('1 - Teaching Assistant\n2 - Chemistry', courses);

    expect(rows[0]).toMatchObject({
      periodNumber: 1,
      className: 'Teaching Assistant',
      matchedCourse: null,
    });
  });

  it('correctly parses Infinite Campus schedule table with teacher details and colons', () => {
    const scheduleText = [
      '1 AP Comp Sci Prin Teacher: VACANT, SUB 10',
      '8:55 AM - 9:48 AM Room: 252',
      '2 FVS Virtual Lab Teacher: Danner, Gina',
      '9:49 AM - 10:42 AM Room: Auditorium',
      '3 Lit/Comp II H Teacher: MARTIN, JOSHUA LEE',
      '10:43 AM- 11:36 AM Room: 265',
      '4 Lunch - 1st Sem',
      '11:37 AM 12:30 PM',
      'SSS/Flex Flex/Student Success Skills Teacher: MCNELIS, KATHERINE',
      '12:31 PM - 12:39 PM Room: 332',
      '5 Advanced Algebra: C&C Teacher: MCNELIS, KATHERINE',
      '12:40 PM - 1:33 PM Room: 332',
      '6 AP World History Teacher: WILLIS, KIARA R',
      '1:34 PM - 2:27 PM Room: 274',
      '7 Earth Systems Teacher: WEIGAND, PATRICK A',
      'Room: 342',
      '8 Engineer Concepts Teacher: HUNTLEY, DANIEL C',
      '3:22 PM - 4:15 PM Room: 181',
      '9 IT Pathway',
    ].join('\n');

    const rows = parseInfiniteCampusSchedule(scheduleText, courses);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.find((r) => r.periodNumber === 1)?.className).toContain('AP Comp Sci Prin');
    expect(rows.find((r) => r.periodNumber === 2)?.className).toContain('FVS Virtual Lab');
    expect(rows.find((r) => r.periodNumber === 3)?.className).toContain('Lit/Comp');
    expect(rows.find((r) => r.periodNumber === 5)?.className).toContain('Advanced Algebra');
    expect(rows.find((r) => r.periodNumber === 6)?.className).toContain('AP World History');
    expect(rows.find((r) => r.periodNumber === 7)?.className).toContain('Earth Systems');
    expect(rows.find((r) => r.periodNumber === 8)?.className).toContain('Engineer Concepts');
  });
});

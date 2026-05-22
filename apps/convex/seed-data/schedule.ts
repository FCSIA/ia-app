import type { Doc } from '../src/_generated/dataModel';
import type { Pathway, ScheduleWeekday } from '../src/validators';

type CourseLike = Pick<Doc<'courses'>, '_id' | 'slug' | 'title' | 'minGrade' | 'maxGrade'>;
type StudentLike = Pick<
  Doc<'users'>,
  '_id' | 'uniqueId' | 'gradeLevel' | 'major' | 'minor' | 'lastName' | 'firstName'
>;

export const SCHEDULE_WEEKDAYS: ScheduleWeekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

export const BASE_BLOCKS = [
  { label: 'Period 1', periodNumber: 1, startTime: '08:10', endTime: '08:55' },
  { label: 'Period 2', periodNumber: 2, startTime: '09:00', endTime: '09:45' },
  { label: 'Period 3', periodNumber: 3, startTime: '09:50', endTime: '10:35' },
  { label: 'Period 4', periodNumber: 4, startTime: '10:40', endTime: '11:25' },
  { label: 'Lunch', periodNumber: null, startTime: '11:25', endTime: '11:55' },
  { label: 'Period 5', periodNumber: 5, startTime: '11:55', endTime: '12:40' },
  { label: 'Period 6', periodNumber: 6, startTime: '12:45', endTime: '13:30' },
  { label: 'Period 7', periodNumber: 7, startTime: '13:35', endTime: '14:20' },
  { label: 'Period 8', periodNumber: 8, startTime: '14:30', endTime: '15:15' },
] as const;

const INTRO_BY_PATHWAY: Record<Pathway, string[]> = {
  ENGINEERING: [
    'foundations-of-engineering-and-technology',
    'introduction-to-software-technology',
    'intro-to-healthcare-science',
  ],
  INFORMATION_TECHNOLOGY: [
    'introduction-to-software-technology',
    'foundations-of-engineering-and-technology',
    'intro-to-healthcare-science',
  ],
  HEALTH_SCIENCE: [
    'intro-to-healthcare-science',
    'introduction-to-software-technology',
    'foundations-of-engineering-and-technology',
  ],
};

const PATHWAY_ADVANCEMENT: Record<
  Pathway,
  { sophomore: string[]; junior: string[]; senior: string[] }
> = {
  ENGINEERING: {
    sophomore: ['engineering-concepts'],
    junior: ['engineering-applications'],
    senior: ['research-design-and-project-management'],
  },
  INFORMATION_TECHNOLOGY: {
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
  HEALTH_SCIENCE: {
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

const FALLBACK_ELECTIVES: Record<9 | 10 | 11 | 12, string[]> = {
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
};

function stableIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

export function stableScheduleVisibility(seed: string) {
  return stableIndex(`${seed}:visibility`, 100) < 68;
}

function isScheduleGrade(gradeLevel: number): gradeLevel is 9 | 10 | 11 | 12 {
  return gradeLevel === 9 || gradeLevel === 10 || gradeLevel === 11 || gradeLevel === 12;
}

function isCourseAllowedForGrade(course: CourseLike, gradeLevel: number) {
  if (course.minGrade != null && gradeLevel < course.minGrade) return false;
  if (course.maxGrade != null && gradeLevel > course.maxGrade) return false;
  return true;
}

export function compareStudents(left: StudentLike, right: StudentLike) {
  return (
    left.lastName.localeCompare(right.lastName) ||
    left.firstName.localeCompare(right.firstName) ||
    left.uniqueId.localeCompare(right.uniqueId)
  );
}

export function buildScheduleCourses(
  student: StudentLike,
  courseMap: Map<string, CourseLike>,
) {
  const gradeLevel = student.gradeLevel;
  if (!gradeLevel || !isScheduleGrade(gradeLevel) || !student.major || !student.minor) {
    return [];
  }

  const picks: CourseLike[] = [];
  const used = new Set<string>();

  const pickOne = (options: string[], salt: string) => {
    const available = options.filter((slug) => {
      const course = courseMap.get(slug);
      return !!course && !used.has(slug) && isCourseAllowedForGrade(course, gradeLevel);
    });
    if (available.length === 0) return;
    const slug = available[stableIndex(`${student.uniqueId}:${salt}`, available.length)];
    const course = courseMap.get(slug);
    if (!course) return;
    picks.push(course);
    used.add(slug);
  };

  if (gradeLevel === 9) {
    pickOne(['literature-and-composition-i', 'literature-and-composition-i-honors'], 'ela');
    pickOne([
      'algebra-concepts-and-connections',
      'algebra-concepts-and-connections-honors',
      'geometry-concepts-and-connections',
      'geometry-concepts-and-connections-honors',
    ], 'math');
    pickOne(['biology', 'biology-honors', 'super-biology'], 'science');
    pickOne(['american-government-civics', 'ap-human-geography'], 'social-studies');
    pickOne(['economics', 'fvs-health'], 'required-elective');
    pickOne(INTRO_BY_PATHWAY[student.major], 'major-intro');
    pickOne(INTRO_BY_PATHWAY[student.minor], 'minor-intro');
    pickOne(FALLBACK_ELECTIVES[9], 'fallback');
  }

  if (gradeLevel === 10) {
    pickOne([
      'literature-and-composition-ii',
      'literature-and-composition-ii-honors',
      'ap-seminar',
    ], 'ela');
    pickOne([
      'geometry-concepts-and-connections',
      'geometry-concepts-and-connections-honors',
      'advanced-algebra-concepts-and-connections',
      'advanced-algebra-concepts-and-connections-honors',
      'enhanced-advanced-algebra-and-ap-precalculus',
    ], 'math');
    pickOne([
      'earth-systems',
      'honors-chemistry',
      'ap-environmental-science',
      'ap-biology',
    ], 'science');
    pickOne(['world-history', 'ap-world-history'], 'social-studies');
    pickOne(PATHWAY_ADVANCEMENT[student.major].sophomore, 'major-pathway');
    pickOne(PATHWAY_ADVANCEMENT[student.minor].sophomore, 'minor-pathway');
    pickOne(FALLBACK_ELECTIVES[10], 'fallback');
    pickOne([
      'ap-human-geography',
      'beginning-music-technology',
      'audio-visual-film-and-technology-i',
      'yearbook',
    ], 'extra-elective');
  }

  if (gradeLevel === 11) {
    pickOne([
      '11th-american-literature-and-composition',
      '11th-american-literature-and-composition-honors',
      'ap-language-and-composition',
      'world-literature',
    ], 'ela');
    pickOne([
      'pre-calculus',
      'ap-precalculus',
      'calculus',
      'ap-statistics',
      'advanced-mathematical-decision-making',
    ], 'math');
    pickOne([
      'physics',
      'honors-physics',
      'ap-physics-1',
      'ap-biology',
      'ap-chemistry',
    ], 'science');
    pickOne(['us-history', 'ap-us-history', 'ap-psychology'], 'social-studies');
    pickOne(PATHWAY_ADVANCEMENT[student.major].junior, 'major-pathway');
    pickOne(PATHWAY_ADVANCEMENT[student.minor].junior, 'minor-pathway');
    pickOne(['ia-research-honors', 'ap-research', 'ap-seminar'], 'research');
    pickOne(FALLBACK_ELECTIVES[11], 'fallback');
  }

  if (gradeLevel === 12) {
    pickOne([
      'world-literature',
      'ap-english-literature-and-composition',
      'dramatic-writing',
      'ap-language-and-composition',
    ], 'ela');
    pickOne([
      'calculus',
      'ap-calculus-ab',
      'ap-calculus-bc',
      'ap-statistics',
      'advanced-mathematical-decision-making',
      'pre-calculus',
    ], 'math');
    pickOne([
      'ap-chemistry',
      'ap-biology',
      'ap-physics-c-mechanics',
      'ap-physics-c-electricity-and-magnetism',
      'forensic-science',
      'astronomy',
      'organic-chemistry-honors',
    ], 'science');
    pickOne([
      'ap-government-and-politics',
      'ap-microeconomics',
      'ap-macroeconomics',
      'ap-art-history',
      'ap-comparative-government-and-politics',
      'us-history-in-film',
      'ap-psychology',
    ], 'social-studies');
    pickOne(PATHWAY_ADVANCEMENT[student.major].senior, 'major-pathway');
    pickOne(PATHWAY_ADVANCEMENT[student.minor].senior, 'minor-pathway');
    pickOne(['ap-research', 'ia-research-honors', 'beacon-writing-staff'], 'research');
    pickOne(FALLBACK_ELECTIVES[12], 'fallback');
  }

  while (picks.length < 8) {
    const before = picks.length;
    pickOne(FALLBACK_ELECTIVES[gradeLevel], `fill-fallback-${picks.length}`);
    if (picks.length >= 8) break;
    pickOne([...courseMap.keys()], `fill-any-${picks.length}`);
    if (picks.length === before) break;
  }

  return picks.slice(0, 8);
}

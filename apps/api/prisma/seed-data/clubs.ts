import type { Pathway } from '@prisma/client';

export type SeedClubCategory =
  | 'PATHWAY'
  | 'ACADEMIC'
  | 'LEADERSHIP'
  | 'CREATIVE'
  | 'SERVICE'
  | 'HONOR'
  | 'COMPETITIVE';

export type SeedClubDefinition = {
  name: string;
  description: string;
  joinPolicy: 'OPEN' | 'REQUEST';
  category: SeedClubCategory;
  pathway?: Pathway | null;
  gradeLevels?: number[];
};

export const CLUB_DEFINITIONS: SeedClubDefinition[] = [
  {
    name: 'Robotics Club',
    description:
      'Competition robotics, autonomous testing, fabrication sprints, and regional scrimmage prep.',
    joinPolicy: 'OPEN',
    category: 'PATHWAY',
    pathway: 'ENGINEERING',
  },
  {
    name: 'Girls Who Code',
    description:
      'Peer-led coding workshops, portfolio projects, and hackathon collaboration for students building in tech.',
    joinPolicy: 'OPEN',
    category: 'PATHWAY',
    pathway: 'INFORMATION_TECHNOLOGY',
  },
  {
    name: 'HOSA',
    description:
      'Health-science competition prep, clinical skills practice, and service events tied to pathway learning.',
    joinPolicy: 'REQUEST',
    category: 'PATHWAY',
    pathway: 'HEALTH_SCIENCE',
  },
  {
    name: 'Science Olympiad',
    description:
      'Build events, study events, and tournament preparation across biology, chemistry, and engineering.',
    joinPolicy: 'REQUEST',
    category: 'COMPETITIVE',
  },
  {
    name: 'Math Team',
    description:
      'Problem-solving sessions, contest practice, and collaborative coaching for AMC-style competition math.',
    joinPolicy: 'REQUEST',
    category: 'ACADEMIC',
  },
  {
    name: 'Quiz Bowl',
    description:
      'Fast-paced tossup and bonus practice spanning literature, science, social studies, and current events.',
    joinPolicy: 'REQUEST',
    category: 'COMPETITIVE',
  },
  {
    name: 'Technology Student Association',
    description:
      'Hands-on technical challenges, design presentations, and TSA event teams across pathway disciplines.',
    joinPolicy: 'REQUEST',
    category: 'COMPETITIVE',
    pathway: 'ENGINEERING',
  },
  {
    name: 'CyberPatriot',
    description:
      'Defensive cybersecurity training, image hardening, and competition drills for security-minded students.',
    joinPolicy: 'REQUEST',
    category: 'COMPETITIVE',
    pathway: 'INFORMATION_TECHNOLOGY',
  },
  {
    name: 'AI Research Club',
    description:
      'Applied machine-learning demos, ethics discussions, and student-built AI experiments outside class.',
    joinPolicy: 'REQUEST',
    category: 'PATHWAY',
    pathway: 'INFORMATION_TECHNOLOGY',
  },
  {
    name: 'Biotechnology Club',
    description:
      'Wet-lab skill building, biotech news breakdowns, and student-led bioscience exploration.',
    joinPolicy: 'REQUEST',
    category: 'PATHWAY',
    pathway: 'HEALTH_SCIENCE',
  },
  {
    name: 'Engineering Design Guild',
    description:
      'Prototype critiques, CAD showcases, and applied design-challenge workshops for makers across grades.',
    joinPolicy: 'OPEN',
    category: 'PATHWAY',
    pathway: 'ENGINEERING',
  },
  {
    name: 'Game Design Collective',
    description:
      'Game jams, playtesting, animation critiques, and level-design reviews for interactive-media students.',
    joinPolicy: 'OPEN',
    category: 'PATHWAY',
    pathway: 'INFORMATION_TECHNOLOGY',
  },
  {
    name: 'eSports',
    description:
      'Competitive gaming, strategy review, streaming, and team coordination for IA’s eSports community.',
    joinPolicy: 'OPEN',
    category: 'COMPETITIVE',
    pathway: 'INFORMATION_TECHNOLOGY',
  },
  {
    name: 'Fencing Club',
    description:
      'Technique practice, match prep, and student-run training for IA’s competitive fencing program.',
    joinPolicy: 'OPEN',
    category: 'COMPETITIVE',
  },
  {
    name: 'Mu Alpha Theta',
    description:
      'Math honor society programming built around tutoring, enrichment, and competition support.',
    joinPolicy: 'REQUEST',
    category: 'HONOR',
  },
  {
    name: 'Science National Honor Society',
    description:
      'Science honor society service, speaker events, outreach, and STEM mentorship projects.',
    joinPolicy: 'REQUEST',
    category: 'HONOR',
  },
  {
    name: 'National English Honor Society',
    description:
      'Reading initiatives, writing workshops, and literary programming for students active in English studies.',
    joinPolicy: 'REQUEST',
    category: 'HONOR',
  },
  {
    name: '9th Grade Student Government',
    description:
      'Freshman student voice, event planning, and service coordination for the class of ninth graders.',
    joinPolicy: 'REQUEST',
    category: 'LEADERSHIP',
    gradeLevels: [9],
  },
  {
    name: '10th Grade Student Government',
    description:
      'Sophomore student leadership focused on class culture, event planning, and service projects.',
    joinPolicy: 'REQUEST',
    category: 'LEADERSHIP',
    gradeLevels: [10],
  },
  {
    name: '11th Grade Student Government',
    description:
      'Junior student leadership focused on school events, student advocacy, and class initiatives.',
    joinPolicy: 'REQUEST',
    category: 'LEADERSHIP',
    gradeLevels: [11],
  },
  {
    name: '12th Grade Student Government',
    description:
      'Senior leadership team responsible for traditions, showcases, and large school-community events.',
    joinPolicy: 'REQUEST',
    category: 'LEADERSHIP',
    gradeLevels: [12],
  },
  {
    name: 'IA Beacon',
    description:
      'Student publication staff collaborating on reporting, editing, photography, and feature planning.',
    joinPolicy: 'OPEN',
    category: 'CREATIVE',
  },
  {
    name: 'Debate Union',
    description:
      'Argument clinics, policy and public-forum practice, and speaking workshops for students who like live reasoning.',
    joinPolicy: 'OPEN',
    category: 'ACADEMIC',
  },
  {
    name: 'Art & Design Lab',
    description:
      'Collaborative studio sessions, critiques, poster design, and showcase prep for visual-art students.',
    joinPolicy: 'OPEN',
    category: 'CREATIVE',
  },
  {
    name: 'Music Production Club',
    description:
      'Beat sessions, songwriting swaps, live recording experiments, and peer feedback on student tracks.',
    joinPolicy: 'OPEN',
    category: 'CREATIVE',
  },
  {
    name: 'Service Leadership Council',
    description:
      'Community impact planning, volunteer logistics, and schoolwide service initiatives.',
    joinPolicy: 'OPEN',
    category: 'SERVICE',
  },
];

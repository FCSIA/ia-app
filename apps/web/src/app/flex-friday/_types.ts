import type { Doc } from '~/apps/convex/src/_generated/dataModel';

export type FlexFridayDoc = Doc<'flexFridays'>;
export type FlexSessionDoc = Doc<'flexSessions'>;

export type FlexWorkshopDoc = Omit<Doc<'flexWorkshops'>, 'sessionIds'> & { 
  _count?: { registrations: number };
  linkedSessions?: { _id: any; title: string; startTime: string; endTime: string }[];
};

export type SessionType = 'STUDENT_CHOICE' | 'TEACHER_ASSIGNED';

export interface SessionForm {
  title: string;
  description: string;
  sessionType: SessionType;
  startTime: string;
  endTime: string;
}

export interface WorkshopForm {
  title: string;
  description: string;
  location: string;
  capacity: string;
  sessionIds: string[];
  targetGrades: number[];
  targetMajorPathways: string[];
  targetMinorPathways: string[];
}

export interface FridayForm {
  date: string;
  type: 'ALL_STUDENT' | 'GRADE_SPECIFIC' | 'PATHWAY_SPECIFIC' | 'TEACHER_PD';
  gradeLevel: string;
  pathway: string;
  notes: string;
  isSchoolDay: boolean;
}


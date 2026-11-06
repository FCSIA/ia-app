import type { FunctionReturnType } from 'convex/server';
import type { api } from '~/apps/convex/src/_generated/api';
import type { Pathway } from '~/apps/shared/labels';

export type FlexFriday = FunctionReturnType<typeof api.flexFriday.fridays.list>[number];
export type FlexSession = FunctionReturnType<typeof api.flexFriday.sessions.listByFriday>[number];
export type FlexWorkshop = FunctionReturnType<typeof api.flexFriday.workshops.listBySession>[number];
export type SessionType = FlexSession['sessionType'];
export type FridayType = FlexFriday['type'];

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
  targetMajorPathways: Pathway[];
  targetMinorPathways: Pathway[];
}

export interface FridayForm {
  date: string;
  type: FridayType;
  gradeLevel: string;
  pathway: Pathway;
  notes: string;
  isSchoolDay: boolean;
}

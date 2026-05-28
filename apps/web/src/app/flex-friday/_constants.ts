import { SessionForm, WorkshopForm, FridayForm } from './_types';

export const EMPTY_SESSION_FORM: SessionForm = {
  title: '',
  description: '',
  sessionType: 'STUDENT_CHOICE',
  startTime: '13:00',
  endTime: '14:30',
};

export const EMPTY_WORKSHOP_FORM: WorkshopForm = {
  title: '',
  description: '',
  location: '',
  capacity: '',
  sessionIds: [],
  targetGrades: [],
  targetMajorPathways: [],
  targetMinorPathways: [],
};

export const EMPTY_FRIDAY_FORM: FridayForm = {
  date: '',
  type: 'ALL_STUDENT',
  gradeLevel: '9',
  pathway: 'INFORMATION_TECHNOLOGY',
  notes: '',
  isSchoolDay: true,
};

import type { AppUser } from './auth';
export type ScheduleWeekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';
export type ScheduleVisibility = 'PUBLIC' | 'PRIVATE' | 'NONE';
export type SchoolDayBlockKind = 'PERIOD' | 'CUSTOM';
export interface SchoolDayBlock {
    id: string;
    weekday: ScheduleWeekday;
    label: string;
    periodNumber: number | null;
    startTime: string;
    endTime: string;
    durationMinutes: number;
}
export interface StudentScheduleEntry {
    id?: string;
    weekday: ScheduleWeekday;
    periodNumber: number;
    className: string;
}
export interface StudentScheduleRecord {
    id: string;
    isPublic: boolean;
    entries: StudentScheduleEntry[];
}
export interface ScheduleFriend {
    id: string;
    user: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'>;
    visibility: ScheduleVisibility;
    schedule: StudentScheduleRecord | null;
}
export interface ScheduleDashboardResponse {
    mySchedule: StudentScheduleRecord | null;
    blocks: SchoolDayBlock[];
    friends: ScheduleFriend[];
}
export interface ScheduleSearchResult {
    id: string;
    uniqueId: string;
    firstName: string;
    lastName: string;
    isFriend: boolean;
    visibility: ScheduleVisibility;
}
export interface SchoolDayBlockPayload {
    weekday: ScheduleWeekday;
    kind: SchoolDayBlockKind;
    periodNumber?: number;
    label?: string;
    startTime: string;
    endTime: string;
}
export interface UpsertStudentSchedulePayload {
    isPublic: boolean;
    entries: StudentScheduleEntry[];
}

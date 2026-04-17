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
export type FriendshipStatus = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS';
export interface ScheduleFriend {
    id: string;
    user: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'>;
    visibility: ScheduleVisibility;
    schedule: StudentScheduleRecord | null;
}
export interface ScheduleFriendRequest {
    id: string;
    user: Pick<AppUser, 'id' | 'uniqueId' | 'firstName' | 'lastName'>;
    createdAt: string;
}
export interface ScheduleDashboardResponse {
    mySchedule: StudentScheduleRecord | null;
    blocks: SchoolDayBlock[];
    friends: ScheduleFriend[];
    incomingRequests: ScheduleFriendRequest[];
    outgoingRequests: ScheduleFriendRequest[];
}
export interface ScheduleSearchResult {
    id: string;
    uniqueId: string;
    firstName: string;
    lastName: string;
    friendshipStatus: FriendshipStatus;
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

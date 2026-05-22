import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { api } from '~/apps/convex/src/_generated/api';

export type ScheduleDashboardResponse = FunctionReturnType<typeof api.schedule.dashboard>;
export type ScheduleFriend = ScheduleDashboardResponse['friends'][number];
export type ScheduleSearchResult = FunctionReturnType<typeof api.schedule.searchPeople>[number];
export type ScheduleVisibility = ScheduleFriend['visibility'];
export type ScheduleWeekday = ScheduleDashboardResponse['blocks'][number]['weekday'];
export type SchoolDayBlock = ScheduleDashboardResponse['blocks'][number];
export type SchoolDayBlockKind = FunctionArgs<typeof api.schedule.createBlock>['kind'];
export type SchoolDayBlockPayload = FunctionArgs<typeof api.schedule.createBlock>;
export type StudentScheduleRecord = NonNullable<ScheduleDashboardResponse['mySchedule']>;
export type StudentScheduleEntry = StudentScheduleRecord['entries'][number];
export type StudentScheduleDraftEntry = Omit<StudentScheduleEntry, 'id'> & {
  id?: StudentScheduleEntry['id'];
};
export type UpsertStudentSchedulePayload = FunctionArgs<typeof api.schedule.saveMine>;

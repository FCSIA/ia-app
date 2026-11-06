import type { FunctionReturnType } from 'convex/server';
import type { api } from '~/apps/convex/src/_generated/api';

type ScheduleDashboardResponse = FunctionReturnType<typeof api.schedule.dashboard.get>;
export type ScheduleLunchPeriod = Exclude<
  NonNullable<ScheduleDashboardResponse['mySchedule']>['lunchPeriod'],
  null
>;
export type ResolvedSchoolDay = ScheduleDashboardResponse['resolvedDay'];
export type ScheduleFriend = ScheduleDashboardResponse['friends'][number];
export type ScheduleSearchResult = FunctionReturnType<typeof api.schedule.friends.search>[number];
export type ScheduleWeekday = ScheduleDashboardResponse['blocks'][number]['weekday'];
export type SchoolDayBlock = ScheduleDashboardResponse['blocks'][number];
export type StudentScheduleRecord = NonNullable<ScheduleDashboardResponse['mySchedule']>;
export type StudentScheduleEntry = StudentScheduleRecord['entries'][number];
export type StudentScheduleDraftEntry = Omit<StudentScheduleEntry, 'id'> & {
  id?: StudentScheduleEntry['id'];
};

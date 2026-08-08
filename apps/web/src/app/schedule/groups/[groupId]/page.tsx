import { ScheduleGroupWorkspace } from './schedule-group-workspace';

export default function ScheduleGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return <ScheduleGroupWorkspace params={params} />;
}

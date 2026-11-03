import { redirect } from 'next/navigation';

/** Groups are managed on the Friends page; keep old links and shares working. */
export default async function ScheduleGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  redirect(`/schedule?tab=friends&group=${encodeURIComponent(groupId)}`);
}

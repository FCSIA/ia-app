import { WorkshopDetail } from '../../../_components/WorkshopDetail';

export default async function WorkshopDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ fridayId: string; workshopId: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const [{ fridayId, workshopId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <WorkshopDetail
      key={`${fridayId}:${workshopId}`}
      fridayId={fridayId}
      workshopId={workshopId}
      selectedSessionId={
        typeof query.session === 'string' ? query.session : undefined
      }
    />
  );
}

'use client';

import { WorkshopDetailUnavailable } from '../../../_components/WorkshopDetail';

export default function WorkshopDetailError({ reset }: { reset: () => void }) {
  return <WorkshopDetailUnavailable failed onRetry={reset} />;
}

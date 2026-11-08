import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BugTagPreview } from './preview';

export const metadata: Metadata = {
  title: 'Local bug tag preview',
  robots: { index: false, follow: false },
};

export default async function LocalBugTagsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const host = (await headers()).get('host') ?? '';
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) notFound();
  return <BugTagPreview />;
}

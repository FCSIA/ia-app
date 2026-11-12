import type { Metadata } from 'next';
import { DeviceApproval } from './device-approval';

export const metadata: Metadata = {
  title: 'Sign in to the command-line client',
  robots: { index: false, follow: false },
};

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string | string[] }>;
}) {
  const { user_code: raw } = await searchParams;
  const code = typeof raw === 'string' ? raw : '';
  return <DeviceApproval initialCode={code} />;
}

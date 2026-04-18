'use client';

import { AppShell } from '@/components/layout/AppShell';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardLayout />
    </AppShell>
  );
}

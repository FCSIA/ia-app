'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { AdminPageContent } from './_components/admin-page-content';

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageFrame>
            <div className="h-48 animate-pulse rounded-lg bg-muted" />
          </PageFrame>
        </AppShell>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}

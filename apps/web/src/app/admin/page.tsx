'use client';

import { Suspense } from 'react';
import { AdminPageLayout } from './_components/admin-page-layout';
import { AdminPageContent } from './_components/admin-page-content';

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <AdminPageLayout>
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </AdminPageLayout>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [editing, setEditing] = useState(false);

  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 sm:px-3"
              aria-label="Customize dashboard"
              onClick={() => setEditing(true)}
            >
              <LayoutGrid />
              <span className="hidden sm:inline">Customize</span>
            </Button>
          ) : null}
        </div>
      }
    >
      <DashboardLayout editing={editing} onEditingChange={setEditing} />
    </AppShell>
  );
}

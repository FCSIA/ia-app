'use client';

import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PushNotificationAnnouncement } from '@/components/dashboard/PushNotificationAnnouncement';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export default function DashboardPage() {
  const [editing, setEditing] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(
    null,
  );
  return (
    <AppShell
      bannerSlot={<PushNotificationAnnouncement />}
      headerSlot={
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <div
            ref={setToolbarTarget}
            className={editing ? 'min-w-0 flex-1' : 'hidden'}
          />
          {!editing ? (
            <Tooltip content="Customize dashboard">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Customize dashboard"
                onClick={() => setEditing(true)}
              >
                <LayoutGrid />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      }
    >
      <DashboardLayout
        editing={editing}
        onEditingChange={setEditing}
        toolbarTarget={toolbarTarget}
      />
    </AppShell>
  );
}

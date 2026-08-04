'use client';

import type { ReactNode } from 'react';
import { CalendarDays, FileText, MessageSquareWarning, Sparkles, Users } from 'lucide-react';
import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import type { AdminTabId } from '../_hooks/use-admin-tab';

type AdminShellProps = {
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  isSuperAdmin: boolean;
  canManageWrapped: boolean;
  pendingReports: number;
  children: ReactNode;
};

export function AdminShell({
  activeTab,
  onTabChange,
  isSuperAdmin,
  canManageWrapped,
  pendingReports,
  children,
}: AdminShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as AdminTabId)}
        className="flex h-full min-h-0 w-full flex-1 flex-col"
      >
        <div className="flex shrink-0 flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Admin Panel</h1>
          <TabsList className="max-w-full shrink-0 overflow-x-auto bg-secondary/50 p-1">
            <TabItem value="users" icon={Users} label="Users" />
            {isSuperAdmin ? (
              <TabItem value="schedule" icon={CalendarDays} label="Schedule" />
            ) : null}
            <TabItem
              value="moderation"
              icon={MessageSquareWarning}
              label={pendingReports > 0 ? `Reports (${pendingReports})` : 'Reports'}
            />
            {canManageWrapped ? (
              <TabItem value="wrapped" icon={Sparkles} label="Wrapped" />
            ) : null}
            <TabItem value="audit" icon={FileText} label="Audit Log" />
          </TabsList>
        </div>

        {children}
      </Tabs>
    </div>
  );
}

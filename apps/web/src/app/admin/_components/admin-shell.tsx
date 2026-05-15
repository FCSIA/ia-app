'use client';

import type { ReactNode } from 'react';
import { CalendarDays, FileText, KeyRound, Shield, Sparkles, Users } from 'lucide-react';
import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AdminTabId } from '../_hooks/use-admin-tab';

export type AdminShellLayout = 'scroll' | 'fill';

type AdminShellProps = {
  layout: AdminShellLayout;
  activeTab: AdminTabId;
  onTabChange: (tab: AdminTabId) => void;
  isSuperAdmin: boolean;
  canManageWrapped: boolean;
  pendingReports: number;
  children: ReactNode;
};

export function AdminShell({
  layout,
  activeTab,
  onTabChange,
  isSuperAdmin,
  canManageWrapped,
  pendingReports,
  children,
}: AdminShellProps) {
  const isFill = layout === 'fill';

  return (
    <div className={cn('w-full', isFill && 'flex min-h-0 flex-1 flex-col')}>
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, moderation, and activity logs
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as AdminTabId)}
        className={cn('w-full', isFill && 'flex min-h-0 flex-1 flex-col')}
      >
        <TabsList className="mb-6 shrink-0 bg-secondary/50 p-1">
          <TabItem value="users" icon={Users} label="Users" />
          {isSuperAdmin ? (
            <TabItem value="schedule" icon={CalendarDays} label="Schedule" />
          ) : null}
          <TabItem
            value="moderation"
            icon={Shield}
            label={pendingReports > 0 ? `Moderation (${pendingReports})` : 'Moderation'}
          />
          <TabItem value="permissions" icon={KeyRound} label="Permissions" />
          <TabItem value="student-admins" icon={Users} label="Student Admins" />
          {canManageWrapped ? (
            <TabItem value="wrapped" icon={Sparkles} label="Wrapped" />
          ) : null}
          <TabItem value="audit" icon={FileText} label="Audit Log" />
        </TabsList>

        {children}
      </Tabs>
    </div>
  );
}

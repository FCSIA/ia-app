'use client';

import type { ReactNode } from 'react';
import { ContactRound, FileText, MessageSquareText, MessageSquareWarning, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import type { AdminTabId } from '../_hooks/use-admin-tab';
import { cn } from '@/lib/utils';

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
    <div className={cn(
      "admin-shell grid h-full min-h-0 w-full flex-1 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)]",
      "lg:p-6 p-4"
    )}>
      <div className="relative z-10 lg:col-start-1 lg:row-start-1">
        <h1 className="pb-3 text-xl font-bold text-foreground tracking-tight">
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">Manage users, content, and platform settings</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as AdminTabId)}
        className="relative z-10 contents"
      >
        <div className="mb-4 min-w-0 max-w-full justify-self-start overflow-x-auto lg:col-start-2 lg:row-start-1 lg:justify-self-end lg:mb-0">
          <TabsList>
            <TabItem value="users" icon={Users} label="Users" />
            {isSuperAdmin ? (
              <TabItem value="schedule" icon={ContactRound} label="Student roster" />
            ) : null}
            {isSuperAdmin ? (
              <TabItem value="administrator-roster" icon={ShieldCheck} label="Admin roster" />
            ) : null}
            <TabItem
              value="moderation"
              icon={MessageSquareWarning}
              label={pendingReports > 0 ? `Reports (${pendingReports})` : 'Reports'}
            />
            {isSuperAdmin ? (
              <TabItem value="feedback" icon={MessageSquareText} label="Feedback" />
            ) : null}
            {canManageWrapped ? (
              <TabItem value="wrapped" icon={Sparkles} label="Wrapped" />
            ) : null}
            <TabItem value="audit" icon={FileText} label="Audit Log" />
          </TabsList>
        </div>

        <div className="col-start-1 row-start-3 flex min-h-0 lg:col-span-2 lg:row-start-2">
          {children}
        </div>
      </Tabs>
    </div>
  );
}

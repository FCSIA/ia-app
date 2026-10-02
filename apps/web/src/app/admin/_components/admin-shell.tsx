'use client';

import type { ReactNode } from 'react';
import { ChartLine, ContactRound, FileText, MessageSquareText, MessageSquareWarning, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <div className="admin-shell flex h-full min-h-0 min-w-0 w-full flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as AdminTabId)}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <ScrollArea orientation="horizontal" className="min-w-0 w-full shrink-0" viewportClassName="pb-2">
          <TabsList aria-label="Admin sections">
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
            {isSuperAdmin ? (
              <TabItem value="analytics" icon={ChartLine} label="Analytics" />
            ) : null}
            <TabItem value="audit" icon={FileText} label="Audit Log" />
          </TabsList>
        </ScrollArea>

        <div className="flex min-h-0 min-w-0 flex-1">
          {children}
        </div>
      </Tabs>
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChartLine, ContactRound, FileText, Menu, MessageSquareText, MessageSquareWarning, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarMenu } from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WorkspaceSidebar, WorkspaceSidebarItem, WorkspaceSidebarSection } from '@/components/ui/workspace-sidebar';
import type { AdminTabId } from '../_hooks/use-admin-tab';

type AdminNavigationProps = {
  activeTab: AdminTabId;
  isSuperAdmin: boolean;
  canManageWrapped: boolean;
  pendingReports: number;
};

function AdminNavigation({
  activeTab,
  isSuperAdmin,
  canManageWrapped,
  pendingReports,
  onNavigate,
  bordered,
}: AdminNavigationProps & { onNavigate?: () => void; bordered?: boolean }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams?.toString() ?? '');
  params.delete('tab');
  const suffix = params.size ? `?${params}` : '';
  const sections = [
    { id: 'users' as const, label: 'Users', group: 'People', icon: Users, visible: true },
    { id: 'schedule' as const, label: 'Student roster', group: 'People', icon: ContactRound, visible: isSuperAdmin },
    { id: 'administrator-roster' as const, label: 'Admin roster', group: 'People', icon: ShieldCheck, visible: isSuperAdmin },
    { id: 'moderation' as const, label: pendingReports ? `Reports (${pendingReports})` : 'Reports', group: 'Safety', icon: MessageSquareWarning, visible: true },
    { id: 'feedback' as const, label: 'Feedback', group: 'Safety', icon: MessageSquareText, visible: isSuperAdmin },
    { id: 'wrapped' as const, label: 'Wrapped', group: 'Insights', icon: Sparkles, visible: canManageWrapped },
    { id: 'analytics' as const, label: 'Analytics', group: 'Insights', icon: ChartLine, visible: isSuperAdmin },
    { id: 'audit' as const, label: 'Audit log', group: 'Insights', icon: FileText, visible: true },
  ].filter((section) => section.visible);

  return (
    <WorkspaceSidebar aria-label="Admin sections" bordered={bordered}>
      {['People', 'Safety', 'Insights'].map((group) => (
        <WorkspaceSidebarSection key={group} title={group}>
          <SidebarMenu>
            {sections.filter((section) => section.group === group).map((section) => (
              <WorkspaceSidebarItem
                key={section.id}
                href={`/admin/${section.id}${suffix}`}
                label={section.label}
                icon={section.icon}
                selected={activeTab === section.id}
                onClick={onNavigate}
                className={onNavigate ? 'min-h-11' : undefined}
              />
            ))}
          </SidebarMenu>
        </WorkspaceSidebarSection>
      ))}
    </WorkspaceSidebar>
  );
}

/** Phone navigation uses the same links and permission filtering as desktop. */
export function AdminMobileNavigation(props: AdminNavigationProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open admin sections">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0 px-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <SheetHeader className="shrink-0 p-6 pr-16">
          <SheetTitle>Admin sections</SheetTitle>
          <SheetDescription className="sr-only">Choose an administration page.</SheetDescription>
        </SheetHeader>
        <AdminNavigation {...props} bordered={false} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AdminShell({ children, ...navigation }: AdminNavigationProps & { children: ReactNode }) {
  return (
    <div className="admin-shell flex h-full min-h-0 min-w-0 w-full flex-1">
      <div className="hidden w-64 shrink-0 lg:flex">
        <AdminNavigation {...navigation} />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 p-4 pt-1 md:p-6 md:pt-2 lg:p-8 lg:pt-2">
        {children}
      </div>
    </div>
  );
}

'use client';

import { readStoredJson, writeStoredJson } from '@/lib/browser-storage';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SidebarMenu, SidebarProvider, SidebarTrigger, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, useSidebar } from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WorkspaceSidebar, WorkspaceSidebarItem, WorkspaceSidebarPanel, WorkspaceSidebarSection } from '@/components/ui/workspace-sidebar';
import { ADMIN_SECTION_GROUPS, visibleAdminSections, type AdminAccess, type AdminTabId } from '../_lib/admin-sections';

type AdminNavigationProps = {
  activeTab: AdminTabId;
  access: AdminAccess;
  pendingReports: number;
};

function AdminNavigation({
  activeTab,
  access,
  pendingReports,
  onNavigate,
  bordered,
  resizable = false,
}: AdminNavigationProps & { onNavigate?: () => void; bordered?: boolean; resizable?: boolean }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams?.toString() ?? '');
  params.delete('tab');
  const suffix = params.size ? `?${params}` : '';
  const sections = visibleAdminSections(access);

  const groups = (
    <>
      {ADMIN_SECTION_GROUPS.map((group) => (
        <WorkspaceSidebarSection key={group} title={group}>
          <SidebarMenu>
            {sections.filter((section) => section.group === group).map((section) => (
              <WorkspaceSidebarItem
                key={section.id}
                href={`/admin/${section.id}${suffix}`}
                label={section.id === 'moderation' && pendingReports ? `Reports (${pendingReports})` : section.label}
                icon={section.icon}
                selected={activeTab === section.id}
                onClick={onNavigate}
                className={onNavigate ? 'min-h-11' : undefined}
              />
            ))}
          </SidebarMenu>
        </WorkspaceSidebarSection>
      ))}
    </>
  );
  return resizable
    ? <WorkspaceSidebarPanel aria-label="Admin sections" collapsible="offcanvas">{groups}</WorkspaceSidebarPanel>
    : <WorkspaceSidebar aria-label="Admin sections" bordered={bordered}>{groups}</WorkspaceSidebar>;
}

const LAYOUT_KEY = 'admin-sidebar-layout';

/**
 * Restores the rail's dragged width and collapsed state, then saves changes.
 * Uses the provider's public state, so the official rail stays the behavior owner.
 */
function PersistAdminSidebar() {
  const { width, setWidth, open, setOpen, isResizing } = useSidebar();
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readStoredJson(LAYOUT_KEY) as { width?: unknown; open?: unknown } | null;
    const px = typeof saved?.width === 'string' ? Number.parseFloat(saved.width) : NaN;
    if (Number.isFinite(px)) setWidth(`${Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, px))}px`);
    if (saved?.open === false) setOpen(false);
  }, [setOpen, setWidth]);
  useEffect(() => {
    if (!restored.current || isResizing) return;
    writeStoredJson(LAYOUT_KEY, { width, open });
  }, [width, open, isResizing]);
  return null;
}

/** The content pane; while the rail is collapsed it keeps a gutter for the reopen trigger. */
function AdminContent({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 p-4 pt-1 md:p-6 md:pt-2 lg:p-8 lg:pt-2', !open && 'lg:pl-14')}>
      {open ? null : <SidebarTrigger size="icon-compact" className="absolute left-3 top-3 z-10 hidden lg:inline-flex" />}
      {children}
    </div>
  );
}

/** Phone navigation uses the same links and permission filtering as desktop. */
export function AdminMobileNavigation(props: AdminNavigationProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open admin sections">
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
    // The admin provider is local: no cookie, no global shortcut (the main
    // navigation owns "["), and phones keep the Sheet navigation below lg.
    <SidebarProvider persist={false} shortcut={null} mobileBreakpoint={1024} className="admin-shell flex h-full min-h-0 min-w-0 w-full flex-1">
      <PersistAdminSidebar />
      <AdminNavigation {...navigation} resizable />
      <AdminContent>{children}</AdminContent>
    </SidebarProvider>
  );
}

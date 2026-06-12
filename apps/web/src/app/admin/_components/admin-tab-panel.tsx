'use client';

import type { ReactNode } from 'react';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AdminTabId } from '../_hooks/use-admin-tab';

const TAB_PANEL_BASE = 'min-h-0 flex-1 pt-3';

type AdminTabPanelProps = {
  value: AdminTabId;
  children: ReactNode;
};

/** Standard admin tab content; the tab body owns vertical scrolling. */
export function AdminScrollTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={cn(TAB_PANEL_BASE, 'overflow-y-auto pb-6')}>
      {children}
    </TabPanel>
  );
}

/** Data-workbench tab; inner panels own overflow and pinned controls. */
export function AdminFillTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={cn(TAB_PANEL_BASE, 'flex flex-col overflow-hidden')}>
      {children}
    </TabPanel>
  );
}

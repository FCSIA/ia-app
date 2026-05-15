'use client';

import type { ReactNode } from 'react';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AdminTabId } from '../_hooks/use-admin-tab';

const TAB_PANEL_BASE = 'flex flex-col gap-6';

type AdminTabPanelProps = {
  value: AdminTabId;
  children: ReactNode;
};

/** Standard admin tab content (scrolls with the page). */
export function AdminScrollTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={TAB_PANEL_BASE}>
      {children}
    </TabPanel>
  );
}

/** Users tab: fills remaining viewport height for in-card table scroll. */
export function AdminFillTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={cn(TAB_PANEL_BASE, 'min-h-0 flex-1')}>
      {children}
    </TabPanel>
  );
}

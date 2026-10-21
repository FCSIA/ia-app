'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AdminTabId } from '../_hooks/use-admin-tab';

const TAB_PANEL_BASE = 'min-h-0 min-w-0 flex-1';

type AdminTabPanelProps = {
  value: AdminTabId;
  children: ReactNode;
};

/** Standard admin tab content; the tab body owns vertical scrolling. */
export function AdminScrollTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={cn(TAB_PANEL_BASE, '-mx-1 flex overflow-hidden')}>
      {/* Keep the existing content alignment, with room inside the clipping
          viewport for controls' outset focus rings on every edge. */}
      <ScrollArea className="min-h-0 min-w-0 flex-1" viewportClassName="px-1 pb-6 pt-3">
        {children}
      </ScrollArea>
    </TabPanel>
  );
}

/** Data-workbench tab; inner panels own overflow and pinned controls. */
export function AdminFillTabPanel({ value, children }: AdminTabPanelProps) {
  return (
    <TabPanel value={value} className={cn(TAB_PANEL_BASE, 'flex flex-col overflow-hidden pt-3')}>
      {children}
    </TabPanel>
  );
}

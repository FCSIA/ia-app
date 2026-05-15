'use client';

import type { ReactNode } from 'react';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AdminTabId } from '../_hooks/use-admin-tab';

type AdminTabPanelProps = {
  value: AdminTabId;
  variant?: 'default' | 'users';
  children: ReactNode;
};

export function AdminTabPanel({ value, variant = 'default', children }: AdminTabPanelProps) {
  return (
    <TabPanel
      value={value}
      className={cn(
        variant === 'users'
          ? 'mt-4 flex min-h-0 flex-1 flex-col gap-4'
          : 'mt-4 flex flex-col gap-6',
      )}
    >
      {children}
    </TabPanel>
  );
}

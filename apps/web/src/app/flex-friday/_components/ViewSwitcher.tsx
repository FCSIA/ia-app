import React from 'react';
import { Tabs, TabsList, TabItem } from '@/components/ui/tabs';
import { History, CalendarDays } from 'lucide-react';

interface Props {
  activeView: 'schedule' | 'audit';
  onViewChange: (view: 'schedule' | 'audit') => void;
}

export function ViewSwitcher({ activeView, onViewChange }: Props) {
  return (
    <Tabs value={activeView} onValueChange={(v) => onViewChange(v as 'schedule' | 'audit')}>
      <TabsList>
        <TabItem value="schedule" label="Schedule" icon={CalendarDays} />
        <TabItem value="audit" label="Activity" icon={History} />
      </TabsList>
    </Tabs>
  );
}

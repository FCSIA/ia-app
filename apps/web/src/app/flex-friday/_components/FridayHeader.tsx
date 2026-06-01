import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { CreditsSummary } from './CreditsSummary';
import { ViewSwitcher } from './ViewSwitcher';
import { FlexFridayDoc } from '../_types';

interface Props {
  fridays: FlexFridayDoc[];
  selectedFriday: FlexFridayDoc | null;
  onSelectFriday: (friday: FlexFridayDoc) => void;
  onAddFriday: () => void;
  canManage: boolean;
  isStudent: boolean;
  activeView: 'schedule' | 'audit';
  onViewChange: (view: 'schedule' | 'audit') => void;
  credits: any;
}

export function FridayHeader({
  fridays,
  selectedFriday,
  onSelectFriday,
  onAddFriday,
  canManage,
  isStudent,
  activeView,
  onViewChange,
  credits,
}: Props) {
  return (
    <div className="mb-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Flex Friday</h1>
        {canManage && (
          <Button size="sm" onClick={onAddFriday} className="flex items-center gap-2">
            <Plus size={16} /> Schedule Friday
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-full max-w-[240px]">
            <Select
              value={selectedFriday?._id}
              onValueChange={(id) => {
                const friday = fridays.find((f) => f._id === id);
                if (friday) onSelectFriday(friday);
              }}
            >
              <SelectTrigger placeholder="Select a Friday..." />
              <SelectContent>
                {fridays.map((f, i) => (
                  <SelectItem key={f._id} value={f._id} index={i}>
                    {format(f.date, 'MMMM do, yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isStudent && <ViewSwitcher activeView={activeView} onViewChange={onViewChange} />}
        </div>

        {isStudent && credits != null && <CreditsSummary credits={credits} />}
      </div>
    </div>
  );
}

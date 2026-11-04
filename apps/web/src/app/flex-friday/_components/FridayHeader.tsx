import type { CreditsSummaryData } from './CreditsSummary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { CreditsSummary } from './CreditsSummary';
import type { FlexFridayDoc } from '../_types';

interface Props {
  fridays: FlexFridayDoc[];
  selectedFriday: FlexFridayDoc | null;
  onSelectFriday: (friday: FlexFridayDoc) => void;
  onAddFriday: () => void;
  canManage: boolean;
  isStudent: boolean;
  credits: CreditsSummaryData | null | undefined;
}

export function FridayHeader({
  fridays,
  selectedFriday,
  onSelectFriday,
  onAddFriday,
  canManage,
  isStudent,
  credits,
}: Props) {
  return (
    <div
      className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="w-full sm:w-60">
          <Select
            value={selectedFriday?._id}
            onValueChange={(id) => {
              const friday = fridays.find((f) => f._id === id);
              if (friday) onSelectFriday(friday);
            }}
          >
            <SelectTrigger placeholder="Select a Friday" />
            <SelectContent>
              {fridays.map((f, i) => (
                <SelectItem key={f._id} value={f._id} index={i}>
                  {format(f.date, 'MMMM do, yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isStudent && credits != null && <CreditsSummary credits={credits} />}
        {canManage && (
          <Button size="sm" leadingIcon={Plus} onClick={onAddFriday}>
            Schedule Friday
          </Button>
        )}
      </div>
    </div>
  );
}

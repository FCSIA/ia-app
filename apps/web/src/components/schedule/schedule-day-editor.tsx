'use client';

import { Lock, PencilLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getBlocksForDay, getPeriodNumbersForDay } from './schedule-utils';
import { SchoolDayBlock, ScheduleWeekday, StudentScheduleEntry } from './types';

type ScheduleDayEditorProps = {
  weekday: ScheduleWeekday;
  blocks: SchoolDayBlock[];
  entries: StudentScheduleEntry[];
  onChange: (weekday: ScheduleWeekday, periodNumber: number, className: string) => void;
};

export function ScheduleDayEditor({
  weekday,
  blocks,
  entries,
  onChange,
}: ScheduleDayEditorProps) {
  const dayBlocks = getBlocksForDay(blocks, weekday);
  const periodNumbers = getPeriodNumbersForDay(blocks, weekday);

  return (
    <div className="space-y-4">
      {dayBlocks.filter((block) => block.periodNumber == null).length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {dayBlocks
            .filter((block) => block.periodNumber == null)
            .map((block) => (
              <Card key={block.id} className="rounded-3xl border-border/70 bg-muted/20">
                <CardContent className="flex items-start gap-3 p-4">
                  <Lock className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">{block.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {block.startTime} - {block.endTime}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {periodNumbers.map((periodNumber) => {
          const entry = entries.find(
            (item) => item.weekday === weekday && item.periodNumber === periodNumber,
          );
          const matchingBlock = dayBlocks.find((block) => block.periodNumber === periodNumber);

          return (
            <Card key={periodNumber} className="rounded-3xl border-border/70 bg-background/90">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PencilLine className="size-4 text-orange-600" />
                    <p className="font-medium text-foreground">Period {periodNumber}</p>
                  </div>
                  {matchingBlock ? (
                    <Badge variant="outline" className="rounded-full">
                      {matchingBlock.startTime} - {matchingBlock.endTime}
                    </Badge>
                  ) : null}
                </div>
                <Input
                  value={entry?.className ?? ''}
                  onChange={(event) => onChange(weekday, periodNumber, event.target.value)}
                  className="rounded-2xl"
                  placeholder={`Enter your Period ${periodNumber} class`}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CreditsSemester = {
  key: 'FALL' | 'SPRING';
  label: string;
  earned: number;
  required: number;
  remaining: number;
};

export type CreditsSummaryData = {
  earned: number;
  required: number;
  schoolYearLabel: string;
  semesters?: CreditsSemester[];
};

export function CreditsSummary({ credits }: { credits: CreditsSummaryData }) {
  const yearMet = credits.earned >= credits.required;
  
  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm"
      title={`Flex Friday credits earned during the ${credits.schoolYearLabel} school year`}
    >
      <div className="flex items-center gap-2">
        <CheckCircle
          size={14}
          className={cn(yearMet ? 'text-emerald-500' : 'text-muted-foreground')}
        />
        <span className="font-medium">
          {credits.earned} / {credits.required} <span className="text-xs text-muted-foreground ml-1">credits</span>
        </span>
      </div>

      {credits.semesters && credits.semesters.length > 0 && (
        <div className="hidden items-center gap-3 border-l pl-3 md:flex">
          {credits.semesters.map((sem) => {
            const met = sem.earned >= sem.required;
            return (
              <div
                key={sem.key}
                className="flex items-center gap-1.5 text-xs"
                title={`${sem.label}: ${sem.earned} of ${sem.required} credits`}
              >
                <span className={cn('font-semibold', met ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {sem.label.split(' ')[0]}:
                </span>
                <span className="tabular-nums font-medium">
                  {sem.earned}/{sem.required}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

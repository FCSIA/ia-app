'use client';

import type { ReactNode, Ref } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type DataTableDensity = 'compact' | 'comfortable';

export function dataTableClasses(density: DataTableDensity = 'comfortable') {
  const isCompact = density === 'compact';
  return {
    table: isCompact ? 'text-[11px]' : 'text-[13px]', // Matching table.tsx default text-[13px]
    head: isCompact
      ? 'h-8 px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground'
      : 'px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground',
    cell: isCompact ? 'px-3 py-1.5 align-middle' : 'px-4 py-3 align-top',
  };
}

type DataTablePanelProps = {
  title: string;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  fillHeight?: boolean;
  density?: DataTableDensity;
  className?: string;
  contentClassName?: string;
};

export function DataTablePanel({
  title,
  count,
  toolbar,
  children,
  footer,
  contentRef,
  fillHeight,
  density = 'comfortable',
  className,
  contentClassName,
}: DataTablePanelProps) {
  const densityClasses = dataTableClasses(density);

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden',
        fillHeight && 'h-full min-h-0 flex-1',
        className,
      )}
    >
      <CardHeader className="flex shrink-0 flex-col gap-3 space-y-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{title}</CardTitle>
          {typeof count === 'number' && (
            <Badge variant="solid" color="gray" size="sm" className="px-1.5 py-0 text-[10px] font-bold">
              {count}
            </Badge>
          )}
        </div>
        {toolbar && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{toolbar}</div>}
      </CardHeader>
      <CardContent
        ref={contentRef}
        className={cn(
          'min-h-0 flex-1 overflow-auto p-0',
          densityClasses.table,
          contentClassName,
        )}
      >
        {children}
      </CardContent>
      {footer && <div className="shrink-0">{footer}</div>}
    </Card>
  );
}

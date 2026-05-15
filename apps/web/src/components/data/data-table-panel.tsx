'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type DataTableDensity = 'compact' | 'comfortable';

export function dataTableClasses(density: DataTableDensity = 'comfortable') {
  const isCompact = density === 'compact';
  return {
    table: isCompact ? 'text-[11px]' : 'text-[13px]', // Matching table.tsx default text-[13px]
    head: isCompact
      ? 'h-8 px-3 py-1 text-[11px] uppercase tracking-wide'
      : 'px-4 py-3 text-xs uppercase tracking-wide',
    cell: isCompact ? 'px-3 py-1.5 align-middle' : 'px-4 py-3 align-top',
  };
}

type DataTablePanelProps = {
  title: string;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
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
  fillHeight,
  density = 'comfortable',
  className,
  contentClassName,
}: DataTablePanelProps) {
  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden',
        fillHeight && 'min-h-0 flex-1',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-2.5 space-y-0 shrink-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {typeof count === 'number' && (
            <Badge variant="solid" color="gray" size="sm" className="px-1.5 py-0 text-[10px] font-bold">
              {count}
            </Badge>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </CardHeader>
      <CardContent
        className={cn(
          'min-h-0 flex-1 overflow-auto p-0',
          contentClassName,
        )}
      >
        {children}
      </CardContent>
      {footer && <div className="shrink-0 border-t">{footer}</div>}
    </Card>
  );
}

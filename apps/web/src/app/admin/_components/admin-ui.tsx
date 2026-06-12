'use client';

import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AdminPanelProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminPanel({
  title,
  actions,
  children,
  className,
  contentClassName,
}: AdminPanelProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-col gap-3 space-y-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn('px-4 pb-4 pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

type AdminMetricProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  compact?: boolean;
};

export function AdminMetric({ label, value, detail, compact }: AdminMetricProps) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-semibold text-foreground', compact ? 'text-sm' : 'text-2xl')}>
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

type AdminNoticeProps = {
  title?: string;
  message: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'danger';
  className?: string;
};

export function AdminNotice({
  title,
  message,
  actionLabel,
  onAction,
  tone = 'default',
  className,
}: AdminNoticeProps) {
  const isDanger = tone === 'danger';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border bg-muted/20 px-4 py-8 text-center',
        isDanger && 'border-destructive/30 bg-destructive/5',
        className,
      )}
    >
      {isDanger ? <AlertCircle className="mb-2 size-4 text-destructive" /> : null}
      {title ? (
        <p className={cn('text-sm font-medium text-foreground', isDanger && 'text-destructive')}>
          {title}
        </p>
      ) : null}
      <div className="mt-1 text-sm text-muted-foreground">{message}</div>
      {actionLabel && onAction ? (
        <Button type="button" variant="ghost" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

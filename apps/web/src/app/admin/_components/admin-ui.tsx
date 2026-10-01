'use client';

import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardGroup, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <CardGroup border="outlined" className={cn('overflow-hidden', className)}>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
        </CardHeader>
        <CardContent className={cn('px-4 pb-4 pt-3', contentClassName)}>{children}</CardContent>
      </Card>
    </CardGroup>
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
    <CardGroup border="outlined" className="overflow-hidden">
      <Card className="bg-muted/20 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('mt-2 font-bold text-foreground', compact ? 'text-lg' : 'text-3xl')}>
          {value}
        </p>
        {detail ? <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p> : null}
      </Card>
    </CardGroup>
  );
}

type AdminNoticeProps = {
  title?: string;
  message: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'danger' | 'success';
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
  const isSuccess = tone === 'success';

  return (
    <CardGroup border="outlined" className="overflow-hidden">
      <Card
        className={cn(
          'flex flex-col items-center justify-center px-6 py-10 text-center',
          isDanger && 'bg-destructive/5 border-destructive/20',
          isSuccess && 'bg-emerald/5 border-emerald/20',
          !isDanger && !isSuccess && 'bg-muted/20 border-border/40',
          className,
        )}
      >
        {isDanger ? <AlertCircle className="mb-3 size-5 text-destructive" /> : isSuccess ? (
          <svg className="mb-3 size-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : null}
        {title ? (
          <p className={cn('text-base font-semibold', isDanger && 'text-destructive', isSuccess && 'text-emerald-700', (!isDanger && !isSuccess) && 'text-foreground')}>
            {title}
          </p>
        ) : null}
        <div className="mt-2 text-sm text-muted-foreground max-w-md">{message}</div>
        {actionLabel && onAction ? (
          <Button type="button" variant={isDanger || isSuccess ? 'primary' : 'ghost'} size="sm" onClick={onAction} className="mt-4">
            {actionLabel}
          </Button>
        ) : null}
      </Card>
    </CardGroup>
  );
}

'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
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
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

type AdminMetricProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  compact?: boolean;
};

export function AdminMetric({
  label,
  value,
  detail,
  compact,
}: AdminMetricProps) {
  return (
    <dl className="min-w-0 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-semibold tabular-nums text-foreground',
          compact ? 'text-base' : 'text-2xl',
        )}
      >
        {value}
      </dd>
      {detail ? (
        <dd className="mt-1.5 text-xs text-muted-foreground">{detail}</dd>
      ) : null}
    </dl>
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
    <Empty
      size="inline"
      className={className}
      role={isDanger ? 'alert' : undefined}
    >
      {isDanger ? (
        <AlertCircle className="size-5 text-destructive" />
      ) : isSuccess ? (
        <Check className="size-5 text-success" />
      ) : null}
      <EmptyHeader>
        {title ? <EmptyTitle className="text-sm">{title}</EmptyTitle> : null}
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {actionLabel && onAction ? (
        <Button
          type="button"
          variant={isDanger || isSuccess ? 'primary' : 'ghost'}
          size="sm"
          onClick={onAction}
          className="mt-4"
        >
          {actionLabel}
        </Button>
      ) : null}
    </Empty>
  );
}

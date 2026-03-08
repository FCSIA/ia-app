import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PageFrameProps = {
  children: ReactNode;
  className?: string;
};

type HeroBandProps = {
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
};

type HeroStatProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

type PanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function PageFrame({ children, className }: PageFrameProps) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full max-w-[1580px] flex-col gap-8 px-4 pb-8 pt-2 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </main>
  );
}

export function HeroBand({
  badge,
  title,
  description,
  actions,
  aside,
  children,
  className,
  contentClassName,
}: HeroBandProps) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-muted/30 pb-6 pt-8 px-6 sm:px-8',
        className,
      )}
    >
      <div className="flex flex-col xl:flex-row gap-8 items-start xl:items-center justify-between">
        <div className={cn('space-y-6 flex-1', contentClassName)}>
          {badge ? <div className="flex flex-wrap items-center gap-3">{badge}</div> : null}
          <div className="space-y-4">
            <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          {children}
        </div>
        {aside ? <div className="w-full xl:w-auto flex flex-col gap-3">{aside}</div> : null}
      </div>
    </section>
  );
}

export function HeroStat({ label, value, description, icon: Icon, className }: HeroStatProps) {
  return (
    <Card
      className={cn(
        'rounded-xl shadow-sm border',
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {label}
            </p>
            <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
          </div>
          {Icon ? (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </Card>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <section className={cn('rounded-[1.75rem] border border-border/70 bg-card text-card-foreground shadow-sm shadow-black/5', className)}>
      {title || description || action ? (
        <div className="flex flex-col gap-4 border-b border-border/70 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {title ? <h2 className="text-2xl font-semibold tracking-tight leading-none">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-6 space-y-6', contentClassName)}>{children}</div>
    </section>
  );
}

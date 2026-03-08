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
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1580px] flex-col gap-8 px-4 pb-8 pt-2 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
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
        'overflow-hidden rounded-[2rem] border border-primary/10 bg-[radial-gradient(circle_at_top_left,hsla(var(--primary),0.22),transparent_34%),radial-gradient(circle_at_85%_18%,hsla(var(--chart-4),0.16),transparent_28%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--card)))] shadow-[0_32px_90px_-48px_hsla(var(--primary),0.7)]',
        className,
      )}
    >
      <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className={cn('space-y-6', contentClassName)}>
          {badge ? <div className="flex flex-wrap items-center gap-3">{badge}</div> : null}
          <div className="space-y-4">
            <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl xl:text-6xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-foreground/72 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          {children}
        </div>
        {aside ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{aside}</div> : null}
      </div>
    </section>
  );
}

export function HeroStat({ label, value, description, icon: Icon, className }: HeroStatProps) {
  return (
    <Card
      className={cn(
        'rounded-[1.75rem] border-white/60 bg-white/78 shadow-xl shadow-primary/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]',
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {label}
            </p>
            <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          </div>
          {Icon ? (
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
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
    <Card className={cn('rounded-[1.75rem] border-border/70 shadow-sm shadow-black/5', className)}>
      {title || description || action ? (
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {title ? <CardTitle className="text-2xl tracking-tight">{title}</CardTitle> : null}
            {description ? (
              <CardDescription className="max-w-2xl leading-6">{description}</CardDescription>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('space-y-6', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

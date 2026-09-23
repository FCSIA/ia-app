import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

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
  tone?: 'default' | 'accent';
};

export function PageFrame({ children, className }: PageFrameProps) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1580px] flex-col gap-6 pb-8 pt-2',
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
    <section className={cn('flex flex-col gap-8', className)}>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className={cn('flex-1 space-y-5', contentClassName)}>
          {badge ? <div className="flex flex-wrap items-center gap-3">{badge}</div> : null}
          <div className="space-y-4">
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
              {title}
            </h2>
            {description ? (
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {aside ? (
          <div className="grid w-full grid-cols-2 gap-3 xl:w-[360px] xl:grid-cols-1">
            {aside}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function HeroStat({ label, value, description, icon: Icon, className }: HeroStatProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {Icon ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  tone = 'default',
}: PanelProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-3xl border transition-all duration-300 hover:shadow-lg',
        tone === 'accent'
          ? 'border-accent-foreground/20 bg-gradient-to-br from-accent/90 via-accent/50 to-background/80 backdrop-blur-xl'
          : 'border-border/50 bg-gradient-to-br from-card/90 via-card/50 to-background/80 backdrop-blur-xl',
        className,
      )}
    >
      {title || description || action ? (
        <div className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {title ? (
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('flex-1 p-6', contentClassName)}>{children}</div>
    </section>
  );
}

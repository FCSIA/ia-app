"use client";

import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useShape } from "@/lib/shape-context";
import { Badge } from "@/components/ui/badge";

/** Pointer dragging can cover a panel header while its named grip owns keyboard input. */
export const PanelHeaderDragContext = createContext<
  HTMLAttributes<HTMLDivElement> | undefined
>(undefined);

/**
 * A layout that remembers a panel's settled height can reserve it here. While
 * the panel is loading it holds exactly that height (its skeleton clips inside
 * the frame), so content below does not move when the data arrives.
 */
export const PanelReservedHeightContext = createContext<number | undefined>(
  undefined,
);

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
  actions?: ReactNode;
  href?: string;
  /** Item total shown as a chip right after the title; hidden at 0. */
  count?: number;
  /** The total is a lower bound (the source stopped counting): "N+", shown even at 0. */
  countHasMore?: boolean;
  loading?: boolean;
  loadingRows?: number;
  flush?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "accent";
};

export function PageFrame({ children, className }: PageFrameProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1580px] flex-col gap-6 pb-8 pt-2",
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
    <section className={cn("flex flex-col gap-8", className)}>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className={cn("flex-1 space-y-5", contentClassName)}>
          {badge ? (
            <div className="flex flex-wrap items-center gap-3">{badge}</div>
          ) : null}
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
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
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

export function HeroStat({
  label,
  value,
  description,
  icon: Icon,
  className,
}: HeroStatProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
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
  actions,
  href,
  count,
  countHasMore = false,
  loading = false,
  loadingRows = 3,
  flush = false,
  children,
  className,
  contentClassName,
  tone = "default",
}: PanelProps) {
  const shape = useShape();
  const dragProps = useContext(PanelHeaderDragContext);
  const reservedHeight = useContext(PanelReservedHeightContext);
  const heldHeight = loading && reservedHeight ? reservedHeight : undefined;
  // One title anatomy with or without a link: title, count chip, then (links
  // only) the chevron at the trailing edge. Both rows share the same height.
  const countBadge =
    count !== undefined && (count > 0 || countHasMore) ? (
      <Badge size="sm" className="shrink-0 tabular-nums">
        {count}
        {countHasMore ? "+" : ""}
      </Badge>
    ) : null;
  return (
    <section
      className={cn(
        "flex flex-col border [--panel-inset:1rem] sm:[--panel-inset:1.25rem]",
        shape.container,
        tone === "accent"
          ? "border-transparent bg-accent"
          : cn("bg-card", CARD_SURFACE_FOREGROUND),
        heldHeight && "overflow-hidden",
        className,
      )}
      style={heldHeight ? { height: heldHeight } : undefined}
      aria-busy={loading || undefined}
    >
      {title || description || action || actions ? (
        <div
          data-slot="panel-header"
          {...dragProps}
          className={cn(
            "flex items-center justify-between gap-3 px-(--panel-inset) pt-(--panel-inset)",
            dragProps && "cursor-grab touch-none active:cursor-grabbing",
          )}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            {title ? (
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                {href ? (
                  <Link
                    href={href}
                    className="flex min-h-8 items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-ring pointer-coarse:min-h-11"
                  >
                    <span className="min-w-0 truncate">{title}</span>
                    {countBadge}
                    <ChevronRight
                      aria-hidden
                      className="ml-auto size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                ) : (
                  <span className="flex min-h-8 items-center gap-2 pointer-coarse:min-h-11">
                    <span className="min-w-0 truncate">{title}</span>
                    {countBadge}
                  </span>
                )}
              </h3>
            ) : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions || action ? (
            <div className="shrink-0">{actions ?? action}</div>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "flex-1 p-(--panel-inset)",
          flush && "px-0 sm:px-1",
          contentClassName,
        )}
      >
        {loading ? (
          <div role="status" aria-label="Loading" className="flex flex-col">
            {/* Rows match an inline Card row: 60px tall, text at the row inset. */}
            {Array.from({ length: loadingRows }, (_, index) => (
              <div
                key={index}
                className={cn(
                  "flex h-15 flex-col justify-center gap-2",
                  flush && "px-4",
                )}
              >
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

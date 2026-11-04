'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pins a table header directly under its `DataTableSection` toolbar. The
 * header paints the main surface so rows scroll beneath it, and draws its
 * bottom edge as an inset shadow because collapsed borders do not stick.
 */
export const PINNED_TABLE_HEADER =
  'sticky top-(--table-sticky-top,0px) z-20 bg-(--app-main-bg) [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]';

/**
 * The admin data-table anatomy, taken from the audit log: a toolbar pinned to
 * the top of the tab's scroll viewport, then the table (or list) on the main
 * surface with no card frame. Place it directly in an `AdminScrollTabPanel`;
 * the toolbar pulls up into that viewport's top padding so rows never show
 * above it.
 */
export function DataTableSection({
  label,
  toolbar,
  children,
  className,
}: {
  label: string;
  toolbar: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    // Sticky offsets start below the viewport's top padding; the toolbar's
    // negative top pulls it into that padding, so the header sits that much
    // higher. Its height changes with chips, tabs, and errors.
    const observer = new ResizeObserver(() =>
      sectionRef.current?.style.setProperty(
        '--table-sticky-top',
        `${toolbar.offsetHeight + Number.parseFloat(getComputedStyle(toolbar).top)}px`,
      ),
    );
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} aria-label={label} className={cn('flex min-w-0 flex-col', className)}>
      <div
        ref={toolbarRef}
        className="sticky -top-3 z-30 -mt-3 flex flex-col gap-2 bg-(--app-main-bg) pb-3 pt-3"
      >
        {toolbar}
      </div>
      {children}
    </section>
  );
}

/** The toolbar's live record count, e.g. "12 reports" or "40/120 users". */
export function DataTableCount({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground" role="status" aria-live="polite">
      {children}
    </span>
  );
}

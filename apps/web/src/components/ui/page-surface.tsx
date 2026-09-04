"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { useShape } from "@/lib/shape-context";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import { cn } from "@/lib/utils";

/**
 * An opaque, themed page-level surface.
 *
 * Custom themes can paint a wallpaper photo behind the entire app, so anything
 * rendered straight onto the page background lands on arbitrary colours and can
 * become unreadable. Wrapping that content here puts it on a solid themed
 * surface instead, and re-points `--foreground` at the card token so nested
 * text keeps its contrast pairing.
 *
 * The radius comes from the shape context rather than a hardcoded utility, so
 * these surfaces follow the user's pill/rounded preference like every other
 * primitive. Padding is deliberately left to the caller: a compact mobile panel
 * and a full-width feed container want different insets.
 */
export const PageSurface = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const shape = useShape();

  return (
    <div
      ref={ref}
      {...props}
      data-slot="page-surface"
      className={cn(
        "border border-border/50 bg-surface-2 shadow-surface-1",
        shape.container,
        CARD_SURFACE_FOREGROUND,
        className,
      )}
    />
  );
});

PageSurface.displayName = "PageSurface";

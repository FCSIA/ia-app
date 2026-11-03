"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string
    /** Vertical fills top-down; size the track's height from the parent. */
    orientation?: "horizontal" | "vertical"
  }
>(({ className, value, indicatorClassName, orientation = "horizontal", ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative overflow-hidden rounded-full bg-primary/20",
      orientation === "vertical" ? "h-full w-0.5" : "h-2 w-full",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-primary transition-transform", indicatorClassName)}
      style={{
        transform:
          orientation === "vertical"
            ? `translateY(-${100 - (value || 0)}%)`
            : `translateX(-${100 - (value || 0)}%)`,
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

"use client"

import * as React from "react"
import type {
  ToggleGroupItemProps,
  ToggleGroupMultipleProps,
} from "@radix-ui/react-toggle-group"

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useShape } from "@/lib/shape-context"

type AccessibleFilterGroupName =
  | {
      "aria-label": string
      "aria-labelledby"?: never
    }
  | {
      "aria-label"?: never
      "aria-labelledby": string
    }

type FilterToggleGroupProps = Omit<
  ToggleGroupMultipleProps,
  "aria-label" | "aria-labelledby" | "type"
> &
  AccessibleFilterGroupName

const FilterToggleGroup = React.forwardRef<
  HTMLDivElement,
  FilterToggleGroupProps
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <ToggleGroup
    ref={ref}
    data-slot="filter-toggle-group"
    type="multiple"
    variant="outline"
    size="sm"
    orientation={orientation}
    className={cn("flex-wrap justify-start gap-2", className)}
    {...props}
  />
))

FilterToggleGroup.displayName = "FilterToggleGroup"

const FilterToggleItem = React.forwardRef<
  HTMLButtonElement,
  ToggleGroupItemProps
>(({ className, ...props }, ref) => {
  const shape = useShape()

  return (
    <ToggleGroupItem
      ref={ref}
      data-slot="filter-toggle-item"
      className={cn(
        "min-w-0 max-w-full pointer-coarse:min-h-11 gap-1.5 border-border/70 bg-transparent px-3 text-xs text-muted-foreground shadow-none transition-[background-color,border-color,color,transform] duration-100 hover:border-border hover:bg-hover hover:text-foreground active:scale-[0.98] data-[state=on]:border-border data-[state=on]:bg-active data-[state=on]:text-foreground data-[state=on]:shadow-none [&_svg]:size-3.5",
        shape.button,
        className
      )}
      {...props}
    />
  )
})

FilterToggleItem.displayName = "FilterToggleItem"

function FilterToggleIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="filter-toggle-icon"
      className={cn("shrink-0 [&_svg]:size-3.5", className)}
      {...props}
    />
  )
}

function FilterToggleCount({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="filter-toggle-count"
      className={cn(
        "shrink-0 text-[10px] tabular-nums text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  FilterToggleCount,
  FilterToggleGroup,
  FilterToggleIcon,
  FilterToggleItem,
}
export type { FilterToggleGroupProps }

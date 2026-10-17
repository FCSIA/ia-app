"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { useShape } from "@/lib/shape-context"
import { Elevated } from "@/lib/elevated"
import { POPOVER_SURFACE_FOREGROUND } from "@/lib/surface-classes"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, children, align = "center", sideOffset = 6, collisionPadding = 8, ...props }, ref) => {
  const shape = useShape()
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        asChild
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        {...props}
      >
        <Elevated
          offset={2}
          shadowLevel={3}
          className={cn(
            // Keep portal siblings on the shared overlay layer so a nested
            // Select, Dropdown, or Popover can paint above its parent.
            "z-50 w-72 border-0 p-4 outline-none origin-[--radix-popover-content-transform-origin]",
            POPOVER_SURFACE_FOREGROUND,
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
            shape.container,
            className
          )}
        >
          {children}
        </Elevated>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }

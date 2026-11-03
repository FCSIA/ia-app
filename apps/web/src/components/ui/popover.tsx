"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { popupShape } from "@/components/ui/popup-shape"
import { Elevated } from "@/lib/elevated"
import { POPOVER_SURFACE_FOREGROUND } from "@/lib/surface-classes"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, children, align = "center", sideOffset = 6, collisionPadding = 8, ...props }, ref) => {
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
          data-slot="popover-content"
          offset={2}
          shadowLevel={3}
          className={cn(
            // Keep portal siblings on the shared overlay layer so a nested
            // Select, Dropdown, or Popover can paint above its parent.
            "z-50 w-72 border-0 p-4 outline-none origin-(--radix-popover-content-transform-origin)",
            POPOVER_SURFACE_FOREGROUND,
            "popup-motion",
            // A hairline edge: dark shadows vanish against dark sheets, so the
            // popup needs its own boundary to read as a separate layer.
            "dark:ring-1 dark:ring-white/10",
            popupShape.container,
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

"use client"

import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"
import { Elevated } from "@/lib/elevated"
import { popupShape as shape } from "@/components/ui/popup-shape"
import { POPOVER_SURFACE_FOREGROUND } from "@/lib/surface-classes"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, children, align = "center", sideOffset = 4, ...props }, ref) => {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        asChild
        align={align}
        sideOffset={sideOffset}
        {...props}
      >
        <Elevated
          offset={2}
          shadowLevel={3}
          className={cn(
            "z-[80] w-64 p-4 outline-none popup-motion origin-(--radix-hover-card-content-transform-origin)",
            POPOVER_SURFACE_FOREGROUND,
            shape.container,
            className
          )}
        >
          {children}
        </Elevated>
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Portal>
  )
})
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }

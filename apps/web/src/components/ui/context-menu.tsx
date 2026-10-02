"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { useTouchPrimary } from "@/hooks/use-touch-primary"
import { cn } from "@/lib/utils"
import { POPOVER_SURFACE_FOREGROUND } from "@/lib/surface-classes"

const ContextMenu = ContextMenuPrimitive.Root

// Radix opens on touch after a 700ms hold that only pointer events cancel, and
// at once on Android's native long-press `contextmenu`. Neither knows about
// scrolling or the swipe gestures built on touch events, so a hold that became
// a swipe could still open the menu. On touch-primary devices the trigger runs
// the long-press from those same touch events, then enables Radix just long
// enough to hand it the `contextmenu` a right-click would send.
const LONG_PRESS_MS = 700
// Small enough that a swipe cancels the press before its own gesture engages.
const LONG_PRESS_SLOP_PX = 8
// A touch that lands while content is still gliding only stops the scroll, as
// it does in native scroll views.
const SCROLL_SETTLE_MS = 150

let lastScrollAt = -Infinity
let scrollListeners = 0
const recordScroll = () => {
  lastScrollAt = performance.now()
}

function useScrollTimestamp(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return
    if (scrollListeners++ === 0) {
      document.addEventListener("scroll", recordScroll, {
        capture: true,
        passive: true,
      })
    }
    return () => {
      if (--scrollListeners === 0) {
        document.removeEventListener("scroll", recordScroll, { capture: true })
      }
    }
  }, [enabled])
}

type LongPress = { x: number; y: number; startedAt: number; timer: number }

/**
 * React delivers events from portaled content (a dialog or popover opened from
 * inside the trigger) to the trigger's handlers too. Only events that started
 * inside the trigger's own DOM belong to its menu.
 */
const startedInTrigger = (event: React.SyntheticEvent<HTMLElement>) =>
  event.target instanceof Node && event.currentTarget.contains(event.target)

const ContextMenuTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger>
>(
  (
    {
      disabled,
      onContextMenu,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
      ...props
    },
    forwardedRef
  ) => {
    const isTouchPrimary = useTouchPrimary()
    const managesTouch = isTouchPrimary && !disabled
    const [opening, setOpening] = React.useState(false)
    const triggerRef = React.useRef<HTMLSpanElement | null>(null)
    const pressRef = React.useRef<LongPress | null>(null)
    const touchActiveRef = React.useRef(false)
    const dispatchingRef = React.useRef(false)
    useScrollTimestamp(managesTouch)

    const setRefs = React.useCallback(
      (node: HTMLSpanElement | null) => {
        triggerRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef]
    )

    const cancelPress = React.useCallback(() => {
      if (pressRef.current) window.clearTimeout(pressRef.current.timer)
      pressRef.current = null
    }, [])

    React.useEffect(() => {
      if (!managesTouch) return
      return cancelPress
    }, [managesTouch, cancelPress])

    const openAt = React.useCallback((x: number, y: number) => {
      const trigger = triggerRef.current
      if (!trigger) return
      flushSync(() => setOpening(true))
      dispatchingRef.current = true
      try {
        trigger.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          })
        )
      } finally {
        dispatchingRef.current = false
        setOpening(false)
      }
    }, [])

    return (
      <ContextMenuPrimitive.Trigger
        ref={setRefs}
        disabled={disabled || (managesTouch && !opening)}
        onContextMenu={(event) => {
          onContextMenu?.(event)
          if (!startedInTrigger(event)) {
            // Keep the menu closed. With a pointer, the Radix handler runs
            // next and only skips an event whose default was prevented.
            if (!managesTouch) event.preventDefault()
            return
          }
          if (!managesTouch || dispatchingRef.current) return
          event.preventDefault()
          if (!touchActiveRef.current) {
            // A trackpad, mouse, or keyboard on a touch-primary device.
            const { clientX, clientY } = event
            window.setTimeout(() => openAt(clientX, clientY))
            return
          }
          // Android's own long-press counts only while ours is still intact.
          const press = pressRef.current
          cancelPress()
          if (press && lastScrollAt < press.startedAt) {
            window.setTimeout(() => openAt(press.x, press.y))
          }
        }}
        onTouchStart={(event) => {
          onTouchStart?.(event)
          if (!managesTouch || !startedInTrigger(event)) return
          touchActiveRef.current = true
          cancelPress()
          const startedAt = performance.now()
          if (event.touches.length !== 1) return
          if (startedAt - lastScrollAt < SCROLL_SETTLE_MS) return
          const touch = event.touches[0]
          const press: LongPress = {
            x: touch.clientX,
            y: touch.clientY,
            startedAt,
            timer: 0,
          }
          press.timer = window.setTimeout(() => {
            pressRef.current = null
            // Any scroll since the press began means it was a gesture.
            if (lastScrollAt < startedAt) openAt(press.x, press.y)
          }, LONG_PRESS_MS)
          pressRef.current = press
        }}
        onTouchMove={(event) => {
          onTouchMove?.(event)
          const press = pressRef.current
          if (!press) return
          const touch = event.touches[0]
          if (
            event.touches.length !== 1 ||
            Math.hypot(touch.clientX - press.x, touch.clientY - press.y) >=
              LONG_PRESS_SLOP_PX
          ) {
            cancelPress()
          }
        }}
        onTouchEnd={(event) => {
          onTouchEnd?.(event)
          if (event.touches.length === 0) touchActiveRef.current = false
          cancelPress()
        }}
        onTouchCancel={(event) => {
          onTouchCancel?.(event)
          touchActiveRef.current = false
          cancelPress()
        }}
        {...props}
      />
    )
  }
)
ContextMenuTrigger.displayName = ContextMenuPrimitive.Trigger.displayName

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuPortal = ContextMenuPrimitive.Portal

const ContextMenuSub = ContextMenuPrimitive.Sub

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
      POPOVER_SURFACE_FOREGROUND,
      className
    )}
    {...props}
  />
))
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-[--radix-context-menu-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
        POPOVER_SURFACE_FOREGROUND,
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName =
  ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold text-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}

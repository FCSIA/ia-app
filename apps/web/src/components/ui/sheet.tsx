"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useFixedBottomVisualViewportOffset } from "@/components/ui/use-fixed-bottom-visual-viewport"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] dark:bg-black/75 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg outline-none transition ease-out data-[state=closed]:duration-180 data-[state=open]:duration-240 data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:animate-none motion-reduce:transition-none",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-x-0 bottom-0 max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-3/4 sm:max-w-sm sm:overflow-hidden sm:rounded-none sm:border-l sm:border-t-0 sm:data-[state=closed]:slide-out-to-right sm:data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  overlayClassName?: string
  /** Keep interactive content inside device cutouts and the home indicator. */
  safeArea?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, overlayClassName, safeArea = true, ...props }, ref) => {
  const contentRef = useFixedBottomVisualViewportOffset(
    ref,
    side === "bottom" || side === "right",
  )

  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        ref={contentRef}
        className={cn(
          sheetVariants({ side }),
          "[translate:0_var(--app-fixed-bottom-visual-viewport-offset,0px)] sm:[translate:0_0]",
          // Safe-area insets extend the default padding instead of replacing
          // it. Sheets that set their own padding own their insets too.
          safeArea && side === "top" && "pt-[calc(1.5rem+env(safe-area-inset-top))]",
          safeArea && side === "bottom" && "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          safeArea && side === "left" &&
            "pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          safeArea && side === "right" &&
            "pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-[calc(1.5rem+env(safe-area-inset-top))]",
          className,
        )}
        onPointerDownOutside={(e) => {
          if (e.target instanceof Element && e.target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
          props.onPointerDownOutside?.(e);
        }}
        onInteractOutside={(e) => {
          if (e.target instanceof Element && e.target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
          props.onInteractOutside?.(e);
        }}
        {...props}
      >
        <SheetPrimitive.Close
          className={cn(
            // Matches the ghost icon-sm button: compact for pointers, a full
            // 44px target on touch. The ring shows for keyboard focus only,
            // not for the focus Radix moves here when the sheet opens. It is
            // centered on the first line of a default-padded SheetTitle at
            // every target size.
            "absolute right-[calc(1rem+env(safe-area-inset-right))] z-10 flex size-8 -translate-y-1/2 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] hover:bg-hover hover:text-foreground active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none pointer-coarse:size-11",
            side === "left"
              ? "top-[calc(2.375rem+env(safe-area-inset-top))]"
              : "top-[2.375rem] sm:top-[calc(2.375rem+env(safe-area-inset-top))]",
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 [&>button]:min-h-11 sm:flex-row sm:justify-end sm:[&>button]:min-h-0",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

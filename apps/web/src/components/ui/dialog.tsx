"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIcon } from "@/lib/icon-context";
import { spring, exitFallbackMs } from "@/lib/springs";
import { useShape } from "@/lib/shape-context";
import { SurfaceProvider, useSurface } from "@/lib/surface-context";
import { surfaceClasses } from "@/lib/surface-classes";
import { Button } from "@/components/ui/button";
import { useFixedBottomVisualViewportOffset } from "@/components/ui/use-fixed-bottom-visual-viewport";

const DIALOG_OFFSET = 4;

const DialogOpenContext = createContext(false);

function Dialog({
  children,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps) {
  // Internal state always tracks changes, and the consumer's onOpenChange is
  // notified alongside it — a listener must not replace state handling, or an
  // uncontrolled dialog with an onOpenChange prop could never open. The Root
  // below is always controlled by `open`, so defaultOpen seeds our state
  // instead of being forwarded.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "lg";
  /** Controls the dialog-owned content inset. Use `none` when a composed
   * primitive owns its internal layout and must meet the dialog edge. */
  padding?: "default" | "none";
  /** Classes applied to the dialog-owned close control when a composition
   * needs to align it with an internal header. */
  closeButtonClassName?: string;
  /** Portal target. When set, the overlay and panel render inside this element
   *  (positioned `absolute`) instead of covering the viewport (`fixed`). Pair
   *  with a `position: relative; overflow: hidden` container — and usually
   *  `<Dialog modal={false}>` — to scope a dialog to a bounded region, e.g. a
   *  docs preview. Defaults to the document body / full-viewport behaviour. */
  container?: HTMLElement | null;
  mobilePosition?: "center" | "top";
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      children,
      size = "sm",
      padding = "default",
      closeButtonClassName,
      container,
      mobilePosition = "center",
      ...props
    },
    ref,
  ) => {
    const XIcon = useIcon("x");
    const open = useContext(DialogOpenContext);
    const shape = useShape();
    const substrate = useSurface();
    const dialogLevel = Math.min(substrate + DIALOG_OFFSET, 8);
    const [mounted, setMounted] = useState(false);
    const reduceMotion = useReducedMotion();
    // We remove the framer-motion x/y transforms and use tailwind classes for
    // position so we can use sm: variants for desktop/mobile differences.
    const isMobileTop = mobilePosition === "top";
    const contentRef = useFixedBottomVisualViewportOffset(
      ref,
      !container && !isMobileTop,
    );

    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);

    // Fallback release for the deferred unmount: onAnimationComplete on the
    // panel is the primary signal, but rAF-driven animation callbacks can
    // stall in throttled/background tabs — leaving an invisible full-screen
    // overlay (and Radix's scroll lock) in place. Both exit tweens run at
    // spring.slow.exit, so the fallback tracks that tier.
    useEffect(() => {
      if (open) return;
      const id = setTimeout(() => setMounted(false), exitFallbackMs(spring.slow));
      return () => clearTimeout(id);
    }, [open]);

    const handleExitComplete = () => {
      if (!open) setMounted(false);
    };

    if (!mounted) return null;

    return (
      <DialogPrimitive.Portal forceMount container={container ?? undefined}>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div
            className={cn(
              container ? "absolute" : "fixed",
              "inset-0 z-50 bg-black/40 dark:bg-black/80"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={reduceMotion ? { duration: 0 } : open ? spring.slow : spring.slow.exit}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content ref={contentRef} asChild forceMount {...props}>
          <motion.div
            className={cn(
              container ? "absolute" : "fixed",
              "z-50",
              "[translate:0_var(--app-fixed-bottom-visual-viewport-offset,0px)] sm:[translate:0_0]",
              isMobileTop
                ? "inset-x-2 top-[calc(.5rem+env(safe-area-inset-top))] w-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2"
                : "inset-x-2 bottom-[calc(.5rem+env(safe-area-inset-bottom))] w-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2",
              surfaceClasses(dialogLevel),
              "max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain focus:outline-none",
              padding === "default" && "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
              padding === "none" && "p-0",
              size === "sm" && "sm:max-w-[400px]",
              size === "lg" && "sm:max-w-[540px]",
              shape.container,
              className
            )}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{
              opacity: open ? 1 : 0,
              scale: open ? 1 : 0.97,
            }}
            transition={reduceMotion ? { duration: 0 } : open ? spring.slow : spring.slow.exit}
            onAnimationComplete={handleExitComplete}
          >
            <SurfaceProvider value={dialogLevel}>
              {children}
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={cn(
                    "absolute right-1.5 top-1.5 sm:right-3 sm:top-3 sm:size-8",
                    closeButtonClassName,
                  )}
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            </SurfaceProvider>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 mb-4", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 [&>button]:min-h-11 sm:flex-row sm:justify-end sm:[&>button]:min-h-0",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[16px] text-foreground leading-tight", className)}
    style={{ fontVariationSettings: "'wght' 700" }}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};

"use client";

// Adapted from Fluid Functionalism's Radix ScrollArea, whose scrollbar stays
// mounted while content overflows and uses a lightweight opacity transition.
// Touch-primary devices use native overflow for platform momentum and physics.

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type PointerEventHandler,
  type Ref,
} from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { useTouchPrimary } from "@/hooks/use-touch-primary";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

const ScrollAreaContext = createContext(false);
const ScrollbarVisibleContext = createContext(true);
const SCROLL_LINGER_MS = 600;

type ScrollAreaOrientation = "vertical" | "horizontal" | "both";

interface ScrollAreaProps
  extends ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /** Which axes receive custom scrollbars. Defaults to `vertical`. */
  orientation?: ScrollAreaOrientation;
  /** Classes applied to the actual scrolling viewport. */
  viewportClassName?: string;
  /** Ref for consumers that need the actual scrolling viewport. */
  viewportRef?: Ref<HTMLDivElement>;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

const ScrollArea = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      orientation = "vertical",
      onPointerEnter,
      onPointerLeave,
      scrollHideDelay,
      viewportClassName,
      viewportRef,
      ...props
    },
    ref,
  ) => {
    // Visibility timing is owned by the Fluid fade and scroll-linger state.
    void scrollHideDelay;

    const isTouchPrimary = useTouchPrimary();
    const [hovering, setHovering] = useState(false);
    const [scrolling, setScrolling] = useState(false);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
      () => () => {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      },
      [],
    );

    const handleScroll = () => {
      setScrolling(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => setScrolling(false), SCROLL_LINGER_MS);
    };

    const handlePointerEnter: PointerEventHandler<HTMLDivElement> = (event) => {
      setHovering(true);
      onPointerEnter?.(event);
    };

    const handlePointerLeave: PointerEventHandler<HTMLDivElement> = (event) => {
      setHovering(false);
      onPointerLeave?.(event);
    };

    const viewportClasses = cn("size-full rounded-[inherit]", viewportClassName);

    return (
      <ScrollAreaContext.Provider value={isTouchPrimary}>
        {isTouchPrimary ? (
          <div
            ref={ref}
            role="group"
            data-slot="scroll-area"
            aria-roledescription="scroll area"
            className={cn("relative overflow-hidden", className)}
            {...props}
          >
            <div
              ref={(node) => setRef(viewportRef, node)}
              data-slot="scroll-area-viewport"
              tabIndex={0}
              className={cn(
                viewportClasses,
                orientation === "vertical" && "overflow-y-auto",
                orientation === "horizontal" && "overflow-x-auto",
                orientation === "both" && "overflow-auto",
              )}
            >
              {children}
            </div>
          </div>
        ) : (
          <ScrollbarVisibleContext.Provider value={hovering || scrolling}>
            <ScrollAreaPrimitive.Root
              ref={ref}
              data-slot="scroll-area"
              type="always"
              className={cn("relative overflow-hidden", className)}
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
              {...props}
            >
              <ScrollAreaPrimitive.Viewport
                ref={(node) => setRef(viewportRef, node)}
                data-slot="scroll-area-viewport"
                className={viewportClasses}
                onScroll={handleScroll}
              >
                {children}
              </ScrollAreaPrimitive.Viewport>
              {orientation !== "horizontal" ? <ScrollBar orientation="vertical" /> : null}
              {orientation !== "vertical" ? <ScrollBar orientation="horizontal" /> : null}
              {orientation === "both" ? <ScrollAreaPrimitive.Corner /> : null}
            </ScrollAreaPrimitive.Root>
          </ScrollbarVisibleContext.Provider>
        )}
      </ScrollAreaContext.Provider>
    );
  },
);

ScrollArea.displayName = "ScrollArea";

const ScrollBar = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => {
  const isTouchPrimary = useContext(ScrollAreaContext);
  const visible = useContext(ScrollbarVisibleContext);
  const shape = useShape();

  if (isTouchPrimary) return null;

  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      data-visible={visible ? "" : undefined}
      className={cn(
        "group/scrollbar z-20 flex touch-none select-none",
        "opacity-70 transition-opacity duration-120 ease-out",
        "data-[visible]:opacity-100 data-[visible]:duration-160",
        orientation === "vertical" && "h-full w-2.5",
        orientation === "horizontal" && "h-2.5 w-full flex-col",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative bg-[color-mix(in_oklab,currentColor_18%,transparent)] transition-[background-color,width,height] duration-160 ease-in-out",
          "group-hover/scrollbar:bg-[color-mix(in_oklab,currentColor_30%,transparent)] active:!bg-[color-mix(in_oklab,currentColor_40%,transparent)]",
          shape.bg,
          orientation === "vertical" &&
            "mx-auto my-1 w-1 -translate-x-0.5 group-hover/scrollbar:w-1.5",
          orientation === "horizontal" &&
            "mx-1 my-auto h-1 -translate-y-0.5 group-hover/scrollbar:h-1.5",
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
});

ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
export type { ScrollAreaOrientation, ScrollAreaProps };

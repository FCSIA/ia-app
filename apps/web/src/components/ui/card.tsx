"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { useProximityHover } from "@/hooks/use-proximity-hover";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/springs";

type CardOrientation = "card" | "inline";
type CardBorder = "none" | "outlined";

interface CardGroupContextValue {
  activeIndex: number | null;
  columns: number;
  count: number;
  orientation: CardOrientation;
  outlined: boolean;
  separated: boolean;
  registerItem: (index: number, element: HTMLElement | null) => void;
}

const CardGroupContext = React.createContext<CardGroupContextValue | null>(null);

interface CardGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controls the layout of each card's content. @default "card" */
  orientation?: CardOrientation;
  /** Number of grid columns. Values above one use two-dimensional proximity. */
  columns?: number;
  /** Draw one shared outline, or an outline around each separated card. */
  border?: CardBorder;
  /** Give cards individual geometry instead of one continuous group. */
  separated?: boolean;
  /** Enable the Fluid proximity highlight. @default true */
  proximityHover?: boolean;
}

const CardGroup = React.forwardRef<HTMLDivElement, CardGroupProps>(
  (
    {
      orientation = "card",
      columns = 1,
      border = "none",
      separated = false,
      proximityHover = true,
      className,
      children,
      style,
      onMouseEnter,
      onMouseMove,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const normalizedColumns = Math.max(1, Math.floor(columns));
    const {
      activeIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef, {
      axis: normalizedColumns > 1 ? "xy" : "y",
    });

    let index = 0;
    const indexedChildren = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child;
      return React.cloneElement(
        child as React.ReactElement<{ index?: number }>,
        { index: index++ }
      );
    });
    const count = index;
    const outlined = border === "outlined";

    React.useLayoutEffect(() => {
      measureItems();
    }, [measureItems, count, normalizedColumns, orientation, separated]);

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(measureItems);
      observer.observe(container);
      return () => observer.disconnect();
    }, [measureItems]);

    React.useEffect(() => {
      if (!proximityHover || count === 0 || process.env.NODE_ENV === "production") {
        return;
      }

      const frame = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;

        const registeredIndices = new Set(
          Array.from(
            container.querySelectorAll<HTMLElement>("[data-proximity-index]")
          )
            .map((element) => element.dataset.proximityIndex)
            .filter((value): value is string => value !== undefined)
        );

        if (registeredIndices.size !== count) {
          console.warn(
            `[CardGroup] Expected ${count} proximity item${count === 1 ? "" : "s"}, but ${registeredIndices.size} registered. Render Card children directly or forward CardGroup's injected index to the nested Card.`
          );
        }
      });

      return () => cancelAnimationFrame(frame);
    }, [count, proximityHover]);

    const activeRect =
      proximityHover && activeIndex !== null ? itemRects[activeIndex] : null;
    const contextValue = React.useMemo<CardGroupContextValue>(
      () => ({
        activeIndex,
        columns: normalizedColumns,
        count,
        orientation,
        outlined,
        separated,
        registerItem,
      }),
      [
        activeIndex,
        normalizedColumns,
        count,
        orientation,
        outlined,
        separated,
        registerItem,
      ]
    );

    return (
      <CardGroupContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            containerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          data-slot="card-group"
          data-orientation={orientation}
          className={cn(
            "relative grid",
            separated ? "gap-2" : "gap-0",
            outlined && !separated &&
              "overflow-hidden rounded-xl border border-border/60",
            className
          )}
          style={{
            ...style,
            gridTemplateColumns: `repeat(${normalizedColumns}, minmax(0, 1fr))`,
          }}
          onMouseEnter={(event) => {
            if (proximityHover) handlers.onMouseEnter();
            onMouseEnter?.(event);
          }}
          onMouseMove={(event) => {
            if (proximityHover) handlers.onMouseMove(event);
            onMouseMove?.(event);
          }}
          onMouseLeave={(event) => {
            if (proximityHover) handlers.onMouseLeave();
            onMouseLeave?.(event);
          }}
          {...props}
        >
          <AnimatePresence>
            {activeRect ? (
              <motion.div
                key={sessionRef.current}
                aria-hidden="true"
                className="pointer-events-none absolute z-0 rounded-xl bg-hover"
                initial={{
                  opacity: 0,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                animate={{
                  opacity: 1,
                  top: activeRect.top,
                  left: activeRect.left,
                  width: activeRect.width,
                  height: activeRect.height,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{
                  ...springs.fast,
                  opacity: { duration: 0.08 },
                }}
              />
            ) : null}
          </AnimatePresence>
          {indexedChildren}
        </div>
      </CardGroupContext.Provider>
    );
  }
);
CardGroup.displayName = "CardGroup";

interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  /** Makes the whole card an interactive target without nesting its contents. */
  onClick?: React.MouseEventHandler<HTMLElement>;
  href?: string;
  external?: boolean;
  /** Accessible name for an interactive card. */
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  /** Injected by CardGroup. */
  index?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      onClick,
      href,
      external = false,
      label,
      selected = false,
      disabled = false,
      index,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
    const group = React.useContext(CardGroupContext);
    const registerItem = group?.registerItem;

    React.useLayoutEffect(() => {
      if (index === undefined || !registerItem) return;
      registerItem(index, internalRef.current);
      return () => registerItem(index, null);
    }, [index, registerItem]);

    const interactive = Boolean(href || onClick);
    const inContinuousGroup = Boolean(group && !group.separated);
    const inSeparatedOutlinedGroup = Boolean(
      group?.separated && group.outlined
    );

    const overlay =
      interactive && !disabled ? (
        href ? (
          <Link
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={label}
            aria-current={selected ? "page" : undefined}
            onClick={(event) => onClick?.(event)}
            className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        ) : (
          <button
            type="button"
            aria-label={label}
            aria-pressed={selected || undefined}
            onClick={(event) => onClick?.(event)}
            className="absolute inset-0 z-20 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        )
      ) : null;

    return (
      <div
        ref={(node) => {
          internalRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-slot="card"
        data-orientation={group?.orientation ?? "card"}
        data-selected={selected || undefined}
        data-disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          "relative rounded-xl border bg-card text-card-foreground",
          group && "z-10",
          inContinuousGroup && "rounded-none border-0 bg-transparent",
          inSeparatedOutlinedGroup && "border-border/60",
          group?.separated && !group.outlined && "border-transparent bg-transparent",
          selected && "bg-active",
          disabled && "opacity-50",
          group?.orientation === "inline" && "flex items-center",
          className
        )}
        {...props}
      >
        {children}
        {overlay}
      </div>
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-title"
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-action"
    className={cn("relative z-30", className)}
    {...props}
  />
));
CardAction.displayName = "CardAction";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("p-6 pt-0", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
};
export type { CardGroupProps, CardProps };

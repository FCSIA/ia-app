"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  forwardRef,
  cloneElement,
  type ReactNode,
  type ReactElement,
  type HTMLAttributes,
  type ComponentPropsWithoutRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/springs";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { shapeMap } from "@/lib/shape-context";
import { Elevated } from "@/lib/elevated";

const shape = shapeMap.rounded;

interface MenuItemRenderOptions {
  radio: boolean;
  value: number;
  disabled?: boolean;
  label: string;
  closeOnClick: boolean;
  element: ReactElement;
  children: ReactNode;
}

interface DropdownContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  checkedIndex?: number;
  renderMenuItem?: (options: MenuItemRenderOptions) => ReactElement;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

export function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error("useDropdown must be used within a Dropdown");
  return ctx;
}

interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  checkedIndex?: number;
}

const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  ({ children, checkedIndex, className, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef);

    useEffect(() => {
      measureItems();
    }, [measureItems, children]);

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect =
      checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    return (
      <DropdownContext.Provider value={{ registerItem, activeIndex, checkedIndex }}>
        <div
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onFocus={(e) => {
            const indexAttr = (e.target as HTMLElement)
              .closest("[data-proximity-index]")
              ?.getAttribute("data-proximity-index");
            if (indexAttr != null) {
              const idx = Number(indexAttr);
              setActiveIndex(idx);
              setFocusedIndex(
                (e.target as HTMLElement).matches(":focus-visible") ? idx : null
              );
            }
          }}
          onBlur={(e) => {
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            setFocusedIndex(null);
            setActiveIndex(null);
          }}
          onKeyDown={(e) => {
            const items = Array.from(
              containerRef.current?.querySelectorAll('[role="menuitemradio"]') ?? []
            ) as HTMLElement[];
            const currentIdx = items.indexOf(e.target as HTMLElement);
            if (currentIdx === -1) return;

            if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) {
              e.preventDefault();
              const next = ["ArrowDown", "ArrowRight"].includes(e.key)
                ? (currentIdx + 1) % items.length
                : (currentIdx - 1 + items.length) % items.length;
              items[next].focus();
            } else if (e.key === "Home") {
              e.preventDefault();
              items[0]?.focus();
            } else if (e.key === "End") {
              e.preventDefault();
              items[items.length - 1]?.focus();
            }
          }}
          role="group"
          className={cn(
            `relative flex w-72 max-w-full flex-col gap-0.5 ${shape.container} bg-transparent p-1 select-none`,
            className
          )}
          {...props}
        >
          {/* Selected background */}
          <AnimatePresence>
            {checkedRect && (
              <motion.div
                className={cn(
                  "absolute bg-active pointer-events-none",
                  shape.bg,
                )}
                initial={false}
                animate={{
                  top: checkedRect.top,
                  left: checkedRect.left,
                  width: checkedRect.width,
                  height: checkedRect.height,
                  opacity: 1,
                }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{
                  ...springs.moderate,
                  opacity: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {/* Hover background */}
          <AnimatePresence>
            {activeRect && (
              <motion.div
                key={sessionRef.current}
                className={cn(
                  "absolute bg-hover pointer-events-none",
                  shape.bg,
                )}
                initial={{
                  opacity: 0,
                  top: checkedRect?.top ?? activeRect.top,
                  left: checkedRect?.left ?? activeRect.left,
                  width: checkedRect?.width ?? activeRect.width,
                  height: checkedRect?.height ?? activeRect.height,
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
            )}
          </AnimatePresence>

          {/* Focus ring */}
          <AnimatePresence>
            {focusRect && (
              <motion.div
                className={cn(
                  "absolute pointer-events-none z-20 border border-[#6B97FF]",
                  shape.focusRing,
                )}
                initial={false}
                animate={{
                  left: focusRect.left - 2,
                  top: focusRect.top - 2,
                  width: focusRect.width + 4,
                  height: focusRect.height + 4,
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{
                  ...springs.fast,
                  opacity: { duration: 0.08 },
                }}
              />
            )}
          </AnimatePresence>

          {children}
        </div>
      </DropdownContext.Provider>
    );
  }
);

Dropdown.displayName = "Dropdown";

// ---------------------------------------------------------------------------
// Triggered dropdown
// ---------------------------------------------------------------------------

interface DropdownMenuContextValue {
  open: boolean;
  disabled: boolean;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error(
      "DropdownMenu compound components must be inside <DropdownMenu>"
    );
  }
  return context;
}

interface DropdownMenuProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

function DropdownMenu({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
}: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp !== undefined ? openProp : internalOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  const context = useMemo(() => ({ open, disabled }), [open, disabled]);

  return (
    <DropdownMenuContext.Provider value={context}>
      <DropdownMenuPrimitive.Root
        open={open}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        {children}
      </DropdownMenuPrimitive.Root>
    </DropdownMenuContext.Provider>
  );
}

DropdownMenu.displayName = "DropdownMenu";

interface DropdownTriggerProps
  extends Omit<
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>,
    "asChild"
  > {
  /** Element used as the trigger. Maps to Radix's asChild contract. */
  render?: ReactElement;
}

const DropdownTrigger = forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ render, children, disabled, ...props }, ref) => {
    const { disabled: rootDisabled } = useDropdownMenuContext();
    const isDisabled = disabled || rootDisabled;

    if (render) {
      return (
        <DropdownMenuPrimitive.Trigger
          ref={ref}
          asChild
          disabled={isDisabled}
          {...props}
        >
          {render}
        </DropdownMenuPrimitive.Trigger>
      );
    }

    return (
      <DropdownMenuPrimitive.Trigger ref={ref} disabled={isDisabled} {...props}>
        {children}
      </DropdownMenuPrimitive.Trigger>
    );
  }
);

DropdownTrigger.displayName = "DropdownTrigger";

type RadixContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

interface DropdownContentProps {
  children: ReactNode;
  className?: string;
  checkedIndex?: number;
  side?: RadixContentProps["side"];
  align?: RadixContentProps["align"];
  sideOffset?: number;
  collisionPadding?: RadixContentProps["collisionPadding"];
}

const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
  (
    {
      className,
      children,
      checkedIndex,
      side = "bottom",
      align = "start",
      sideOffset = 6,
      collisionPadding = 8,
    },
    ref
  ) => {
    const { open } = useDropdownMenuContext();
    const containerRef = useRef<HTMLDivElement>(null);
    const {
      activeIndex,
      setActiveIndex,
      itemRects,
      sessionRef,
      handlers,
      registerItem,
      measureItems,
    } = useProximityHover(containerRef);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);

    useEffect(() => {
      if (open) return;
      const timeout = window.setTimeout(() => setMounted(false), 160);
      return () => window.clearTimeout(timeout);
    }, [open]);

    useEffect(() => {
      if (!open || !mounted) return;
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(measureItems);
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }, [open, mounted, measureItems]);

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect = checkedIndex != null ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;

    const renderMenuItem = useCallback(
      ({
        radio,
        value,
        disabled,
        label,
        closeOnClick,
        element,
        children: itemChildren,
      }: MenuItemRenderOptions) => {
        const commonProps = {
          asChild: true as const,
          disabled,
          textValue: label,
          onSelect: closeOnClick
            ? undefined
            : (event: Event) => event.preventDefault(),
        };
        const item = cloneElement(element, {}, itemChildren);

        return radio ? (
          <DropdownMenuPrimitive.RadioItem
            value={String(value)}
            {...commonProps}
          >
            {item}
          </DropdownMenuPrimitive.RadioItem>
        ) : (
          <DropdownMenuPrimitive.Item {...commonProps}>
            {item}
          </DropdownMenuPrimitive.Item>
        );
      },
      []
    );

    const dropdownContext = useMemo(
      () => ({
        registerItem,
        activeIndex,
        checkedIndex,
        renderMenuItem,
      }),
      [registerItem, activeIndex, checkedIndex, renderMenuItem]
    );

    if (!mounted) return null;

    return (
      <DropdownMenuPrimitive.Portal forceMount>
        <DropdownMenuPrimitive.Content
          asChild
          forceMount
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
        >
          <motion.div
            className="z-50 outline-none"
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={
              open
                ? { opacity: 1, y: 0, scaleY: 1 }
                : { opacity: 0, y: -4, scaleY: 0.96 }
            }
            transition={open ? springs.fast : { duration: 0.06 }}
            style={{ transformOrigin: "top center" }}
            onAnimationComplete={() => {
              if (!open) setMounted(false);
            }}
          >
            <DropdownContext.Provider value={dropdownContext}>
              <Elevated
                offset={2}
                shadowLevel={3}
                ref={(node: HTMLDivElement | null) => {
                  (
                    containerRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = node;
                  if (typeof ref === "function") ref(node);
                  else if (ref)
                    (
                      ref as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
                }}
                onMouseEnter={() => {
                  handlers.onMouseEnter();
                  setFocusedIndex(null);
                }}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                onFocus={(event) => {
                  const indexAttribute = (event.target as HTMLElement)
                    .closest("[data-proximity-index]")
                    ?.getAttribute("data-proximity-index");
                  if (indexAttribute != null) {
                    const index = Number(indexAttribute);
                    setActiveIndex(index);
                    setFocusedIndex(
                      (event.target as HTMLElement).matches(":focus-visible")
                        ? index
                        : null
                    );
                  }
                }}
                onBlur={(event) => {
                  if (
                    containerRef.current?.contains(event.relatedTarget as Node)
                  ) {
                    return;
                  }
                  setFocusedIndex(null);
                  setActiveIndex(null);
                }}
                className={cn(
                  `fluid-scrollbar relative flex max-h-[min(480px,var(--radix-dropdown-menu-content-available-height))] w-72 min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-full flex-col gap-0.5 overflow-y-auto ${shape.container} p-1 select-none outline-none`,
                  className
                )}
              >
                <AnimatePresence>
                  {checkedRect ? (
                    <motion.div
                      className={`pointer-events-none absolute ${shape.bg} bg-active`}
                      initial={false}
                      animate={{
                        top: checkedRect.top,
                        left: checkedRect.left,
                        width: checkedRect.width,
                        height: checkedRect.height,
                        opacity: 1,
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{
                        ...springs.moderate,
                        opacity: { duration: 0.08 },
                      }}
                    />
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {activeRect ? (
                    <motion.div
                      key={sessionRef.current}
                      className={`pointer-events-none absolute ${shape.bg} bg-hover`}
                      initial={{
                        opacity: 0,
                        top: checkedRect?.top ?? activeRect.top,
                        left: checkedRect?.left ?? activeRect.left,
                        width: checkedRect?.width ?? activeRect.width,
                        height: checkedRect?.height ?? activeRect.height,
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

                <AnimatePresence>
                  {focusRect ? (
                    <motion.div
                      className={`pointer-events-none absolute z-20 border border-[color:var(--focus-ring,#6B97FF)] ${shape.focusRing}`}
                      initial={false}
                      animate={{
                        left: focusRect.left - 2,
                        top: focusRect.top - 2,
                        width: focusRect.width + 4,
                        height: focusRect.height + 4,
                      }}
                      exit={{ opacity: 0, transition: { duration: 0.06 } }}
                      transition={springs.fast}
                    />
                  ) : null}
                </AnimatePresence>

                <DropdownMenuPrimitive.RadioGroup
                  value={
                    checkedIndex != null ? String(checkedIndex) : undefined
                  }
                  className="contents"
                >
                  {children}
                </DropdownMenuPrimitive.RadioGroup>
              </Elevated>
            </DropdownContext.Provider>
          </motion.div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    );
  }
);

DropdownContent.displayName = "DropdownContent";

// ---------------------------------------------------------------------------
// DropdownLabel
// ---------------------------------------------------------------------------

const DropdownLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-[11px] text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);

DropdownLabel.displayName = "DropdownLabel";

// ---------------------------------------------------------------------------
// DropdownSeparator
// ---------------------------------------------------------------------------

const DropdownSeparator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("my-1 -mx-1 h-px bg-border/60", className)}
    {...props}
  />
));

DropdownSeparator.displayName = "DropdownSeparator";

export {
  Dropdown,
  DropdownLabel,
  DropdownSeparator,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
};
export type {
  DropdownProps,
  DropdownMenuProps,
  DropdownTriggerProps,
  DropdownContentProps,
  MenuItemRenderOptions,
};
export default Dropdown;

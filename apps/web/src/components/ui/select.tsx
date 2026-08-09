"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { AnimatePresence, motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/springs";
import { useProximityHover } from "@/hooks/use-proximity-hover";
import { useShape } from "@/lib/shape-context";
import { Elevated } from "@/lib/elevated";

const SELECTION_ACK_MS = 300;
const EXIT_FALLBACK_MS = 180;

interface SelectContextValue {
  value: string;
  open: boolean;
  unmount: () => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("Select compound components must be inside <Select>");
  }
  return context;
}

interface SelectContentContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
  checkedIndex?: number;
}

const SelectContentContext = createContext<SelectContentContextValue | null>(
  null,
);

interface SelectProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  name,
  required,
}: SelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [radixOpen, setRadixOpen] = useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const lastPickRef = useRef(0);
  const acknowledgmentTimeoutRef = useRef<number | null>(null);

  const cancelAcknowledgment = useCallback(() => {
    if (acknowledgmentTimeoutRef.current !== null) {
      window.clearTimeout(acknowledgmentTimeoutRef.current);
      acknowledgmentTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => cancelAcknowledgment, [cancelAcknowledgment]);

  const handleValueChange = useCallback(
    (nextValue: string) => {
      lastPickRef.current = performance.now();
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && performance.now() - lastPickRef.current < 100) {
        cancelAcknowledgment();
        acknowledgmentTimeoutRef.current = window.setTimeout(() => {
          acknowledgmentTimeoutRef.current = null;
          setOpen(false);
        }, SELECTION_ACK_MS);
        return;
      }

      cancelAcknowledgment();
      setOpen(nextOpen);
      if (nextOpen) setRadixOpen(true);
    },
    [cancelAcknowledgment],
  );

  const unmount = useCallback(() => setRadixOpen(false), []);
  const contextValue = useMemo(
    () => ({ value: currentValue, open, unmount }),
    [currentValue, open, unmount],
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <SelectPrimitive.Root
        value={currentValue}
        onValueChange={handleValueChange}
        open={radixOpen}
        onOpenChange={handleOpenChange}
        disabled={disabled}
        name={name}
        required={required}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectContext.Provider>
  );
}

Select.displayName = "Select";

const triggerVariants = cva(
  [
    "group inline-flex min-w-[160px] cursor-pointer items-center justify-between gap-2 px-3 text-[13px] outline-none",
    "h-9 transition-all duration-80",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
  ],
  {
    variants: {
      variant: {
        bordered:
          "border border-border bg-transparent text-foreground hover:bg-hover",
        borderless:
          "border border-transparent bg-transparent text-foreground hover:bg-hover",
      },
    },
    defaultVariants: { variant: "bordered" },
  },
);

interface SelectTriggerProps
  extends
    Omit<HTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof triggerVariants> {
  icon?: IconComponent;
  placeholder?: string;
  error?: string;
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  (
    {
      className,
      variant,
      icon: Icon,
      placeholder = "Select…",
      error,
      ...props
    },
    ref,
  ) => {
    const shape = useShape();

    return (
      <div className="flex min-w-0 flex-col gap-1">
        <SelectPrimitive.Trigger
          ref={ref}
          aria-invalid={!!error || undefined}
          className={cn(
            triggerVariants({ variant }),
            shape.input,
            error && "border-destructive/50 hover:border-destructive/50",
            className,
          )}
          {...props}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {Icon ? (
              <Icon
                size={16}
                strokeWidth={1.5}
                className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-hover:text-foreground group-hover:stroke-[2]"
              />
            ) : null}
            <span className="-my-1 min-w-0 flex-1 truncate py-1 text-left [text-box:trim-both_cap_alphabetic] group-data-[placeholder]:text-muted-foreground">
              <SelectPrimitive.Value placeholder={placeholder} />
            </span>
          </span>
          <SelectPrimitive.Icon asChild>
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-muted-foreground transition-colors duration-80 group-hover:text-foreground"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        {error ? (
          <span className="pl-3 text-[12px] text-destructive">{error}</span>
        ) : null}
      </div>
    );
  },
);

SelectTrigger.displayName = "SelectTrigger";

interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children }, ref) => {
    const { open, value, unmount } = useSelectContext();
    const shape = useShape();
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
    const [checkedIndex, setCheckedIndex] = useState<number | undefined>();

    useEffect(() => {
      if (open) return;
      const timeout = window.setTimeout(unmount, EXIT_FALLBACK_MS);
      return () => window.clearTimeout(timeout);
    }, [open, unmount]);

    useEffect(() => {
      if (!open) return;
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => {
          measureItems();
          const items = Array.from(
            containerRef.current?.querySelectorAll("[data-proximity-index]") ??
              [],
          ) as HTMLElement[];
          const index = items.findIndex(
            (item) => item.getAttribute("data-value") === value,
          );
          setCheckedIndex(index >= 0 ? index : undefined);
        });
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        cancelAnimationFrame(innerFrame);
      };
    }, [measureItems, open, value]);

    useEffect(() => {
      if (open) return;
      setCheckedIndex(undefined);
      setActiveIndex(null);
      setFocusedIndex(null);
    }, [open, setActiveIndex]);

    const activeRect = activeIndex !== null ? itemRects[activeIndex] : null;
    const checkedRect =
      checkedIndex !== undefined ? itemRects[checkedIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const contentValue = useMemo(
      () => ({ registerItem, activeIndex, checkedIndex }),
      [activeIndex, checkedIndex, registerItem],
    );

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50"
        >
          <motion.div
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={
              open
                ? { opacity: 1, y: 0, scaleY: 1 }
                : { opacity: 0, y: -4, scaleY: 0.96 }
            }
            transition={springs.fast}
            style={{ transformOrigin: "top center" }}
            onAnimationComplete={() => {
              if (!open) unmount();
            }}
          >
            <SelectContentContext.Provider value={contentValue}>
              <SelectPrimitive.Viewport asChild>
                <Elevated
                  offset={2}
                  shadowLevel={3}
                  ref={(node: HTMLDivElement | null) => {
                    containerRef.current = node;
                    if (typeof ref === "function") ref(node);
                    else if (ref) ref.current = node;
                  }}
                  onMouseEnter={() => {
                    handlers.onMouseEnter();
                    setFocusedIndex(null);
                  }}
                  onMouseMove={handlers.onMouseMove}
                  onMouseLeave={handlers.onMouseLeave}
                  onFocus={(event) => {
                    const indexValue = (event.target as HTMLElement)
                      .closest("[data-proximity-index]")
                      ?.getAttribute("data-proximity-index");
                    if (indexValue === null || indexValue === undefined) return;
                    const index = Number(indexValue);
                    setActiveIndex(index);
                    setFocusedIndex(
                      (event.target as HTMLElement).matches(":focus-visible")
                        ? index
                        : null,
                    );
                  }}
                  onBlur={(event) => {
                    if (
                      containerRef.current?.contains(
                        event.relatedTarget as Node,
                      )
                    )
                      return;
                    setFocusedIndex(null);
                    setActiveIndex(null);
                  }}
                  className={cn(
                    "relative flex max-h-[min(300px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] select-none flex-col gap-0.5 overflow-y-auto p-1 outline-none ![scrollbar-width:thin]",
                    shape.container,
                    className,
                  )}
                >
                  {open && checkedRect ? (
                    <motion.div
                      className={cn(
                        "pointer-events-none absolute bg-active",
                        shape.bg,
                      )}
                      initial={false}
                      animate={{ ...checkedRect, opacity: 1 }}
                      transition={springs.moderate}
                    />
                  ) : null}
                  <AnimatePresence>
                    {open && activeRect ? (
                      <motion.div
                        key={sessionRef.current}
                        className={cn(
                          "pointer-events-none absolute bg-hover",
                          shape.bg,
                        )}
                        initial={{ ...activeRect, opacity: 0 }}
                        animate={{ ...activeRect, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springs.fast}
                      />
                    ) : null}
                  </AnimatePresence>
                  <AnimatePresence>
                    {open && focusRect ? (
                      <motion.div
                        className={cn(
                          "pointer-events-none absolute z-20 border border-[color:var(--focus-ring,#6B97FF)]",
                          shape.focusRing,
                        )}
                        initial={false}
                        animate={{
                          left: focusRect.left - 2,
                          top: focusRect.top - 2,
                          width: focusRect.width + 4,
                          height: focusRect.height + 4,
                        }}
                        exit={{ opacity: 0 }}
                        transition={springs.fast}
                      />
                    ) : null}
                  </AnimatePresence>
                  {children}
                </Elevated>
              </SelectPrimitive.Viewport>
            </SelectContentContext.Provider>
          </motion.div>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);

SelectContent.displayName = "SelectContent";

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
  icon?: IconComponent;
  index: number;
  value: string;
  disabled?: boolean;
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  (
    {
      className,
      children,
      icon: Icon,
      value,
      index,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const selectContext = useSelectContext();
    const contentContext = useContext(SelectContentContext);
    const internalRef = useRef<HTMLDivElement>(null);
    const shape = useShape();
    const registerItem = contentContext?.registerItem;

    useEffect(() => {
      if (!registerItem) return;
      registerItem(index, internalRef.current);
      return () => registerItem(index, null);
    }, [index, registerItem]);

    const isActive = contentContext?.activeIndex === index;
    const isChecked = selectContext.value === value;

    return (
      <SelectPrimitive.Item
        value={value}
        disabled={disabled}
        textValue={typeof children === "string" ? children : undefined}
        ref={(node) => {
          internalRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-proximity-index={index}
        data-value={value}
        className={cn(
          "relative z-10 flex h-9 shrink-0 cursor-pointer select-none items-center gap-2 px-2 text-[13px] outline-none transition-colors duration-80",
          shape.item,
          isActive || isChecked ? "text-foreground" : "text-muted-foreground",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
      >
        {Icon ? (
          <Icon
            size={16}
            strokeWidth={isActive || isChecked ? 2 : 1.5}
            className="shrink-0 transition-[color,stroke-width] duration-80"
          />
        ) : null}
        <span className="-my-1 min-w-0 flex-1 truncate py-1 [text-box:trim-both_cap_alphabetic]">
          <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </span>
        <span aria-hidden className="size-4 shrink-0">
          <AnimatePresence>
            {isChecked ? (
              <motion.svg
                key="check"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
              >
                <motion.path
                  d="M4 12L9 17L20 6"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  exit={{ pathLength: 0 }}
                  transition={{ duration: 0.08, ease: "easeOut" }}
                />
              </motion.svg>
            ) : null}
          </AnimatePresence>
        </span>
      </SelectPrimitive.Item>
    );
  },
);

SelectItem.displayName = "SelectItem";

function SelectGroup({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="group" className={className} {...props}>
      {children}
    </div>
  );
}

const SelectLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "shrink-0 px-2 py-1.5 text-[11px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);

const SelectSeparator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("-mx-1 my-1 h-px shrink-0 bg-border/60", className)}
    {...props}
  />
));

SelectGroup.displayName = "SelectGroup";
SelectLabel.displayName = "SelectLabel";
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  triggerVariants,
};

export type {
  SelectProps,
  SelectTriggerProps,
  SelectContentProps,
  SelectItemProps,
};

"use client";

import {
  useRef,
  useEffect,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { IconComponent } from "@/lib/icon-context";
import { motion, AnimatePresence } from "framer-motion";
import { dropdownShape as shape, useDropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/font-weight";

interface MenuItemProps extends HTMLAttributes<HTMLDivElement> {
  icon?: IconComponent;
  leading?: ReactNode;
  label: string;
  index: number;
  checked?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  /** Whether a popup menu closes after activation. @default true */
  closeOnClick?: boolean;
}

const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      icon: Icon,
      leading,
      label,
      index,
      checked,
      onSelect,
      disabled,
      closeOnClick,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const hasMounted = useRef(false);
    const { registerItem, activeIndex, checkedIndex, renderMenuItem } =
      useDropdown();

    useEffect(() => {
      registerItem(index, internalRef.current);
      return () => registerItem(index, null);
    }, [index, registerItem]);

    useEffect(() => {
      hasMounted.current = true;
    }, []);

    const isActive = activeIndex === index;
    const skipAnimation = !hasMounted.current;

    const mergeRef = (node: HTMLDivElement | null) => {
      (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref)
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const handleActivate = disabled
      ? undefined
      : (event: React.MouseEvent<HTMLDivElement>) => {
          onClick?.(event);
          onSelect?.();
        };

    const itemClassName = cn(
      `relative z-10 flex h-9 shrink-0 cursor-pointer items-center gap-2 ${shape.item} px-2 outline-none`,
      disabled && "pointer-events-none opacity-50",
      className
    );

    const content = (
      <>
        {leading ? <span className="shrink-0">{leading}</span> : null}
        {!leading && Icon ? (
          <span className="inline-grid">
            <span className="invisible col-start-1 row-start-1">
              <Icon size={16} strokeWidth={2} />
            </span>
            <Icon
              size={16}
              strokeWidth={isActive || checked ? 2 : 1.5}
              className={cn(
                "col-start-1 row-start-1 transition-[color,stroke-width] duration-80",
                isActive || checked
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            />
          </span>
        ) : null}
        <span className="inline-grid min-w-0 flex-1 text-[13px]">
          <span
            className="invisible col-start-1 row-start-1 truncate"
            style={{ fontVariationSettings: fontWeights.semibold }}
            aria-hidden="true"
          >
            {label}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1 truncate transition-[color,font-variation-settings] duration-80",
              isActive || checked
                ? "text-foreground"
                : "text-muted-foreground"
            )}
            style={{
              fontVariationSettings: checked
                ? fontWeights.semibold
                : fontWeights.normal,
            }}
          >
            {label}
          </span>
        </span>
        <AnimatePresence>
          {checked ? (
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
              className="shrink-0 text-foreground"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
            >
              <motion.path
                d="M4 12L9 17L20 6"
                initial={{ pathLength: skipAnimation ? 1 : 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.08, ease: "easeOut" },
                }}
                exit={{
                  pathLength: 0,
                  transition: { duration: 0.04, ease: "easeIn" },
                }}
              />
            </motion.svg>
          ) : null}
        </AnimatePresence>
      </>
    );

    if (renderMenuItem) {
      return renderMenuItem({
        radio: typeof checked === "boolean",
        value: index,
        disabled,
        label,
        closeOnClick: closeOnClick ?? true,
        element: (
          <div
            ref={mergeRef}
            data-proximity-index={index}
            aria-label={label}
            onClick={handleActivate}
            className={itemClassName}
            {...props}
          />
        ),
        children: content,
      });
    }

    return (
      <div
        ref={mergeRef}
        data-proximity-index={index}
        tabIndex={!disabled && index === (checkedIndex ?? 0) ? 0 : -1}
        role={typeof checked === "boolean" ? "menuitemradio" : "menuitem"}
        aria-checked={typeof checked === "boolean" ? checked : undefined}
        aria-disabled={disabled || undefined}
        aria-label={label}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            onSelect?.();
          }
        }}
        className={itemClassName}
        {...props}
      >
        {content}
      </div>
    );
  }
);

MenuItem.displayName = "MenuItem";

export { MenuItem };
export type { MenuItemProps };
export default MenuItem;

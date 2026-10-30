"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

const buttonVariants = cva(
  [
    "group relative isolate inline-flex touch-manipulation items-center justify-center outline-none cursor-pointer",
    "whitespace-nowrap align-middle [&_svg]:shrink-0",
    "transition-colors duration-80",
    "disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
  ],
  {
    variants: {
      variant: {
        primary: "text-background",
        secondary: "text-foreground",
        tertiary: "text-foreground",
        ghost: "text-muted-foreground hover:text-foreground",
        destructive: "text-destructive-foreground",
      },
      size: {
        sm: "h-7 px-3 text-[12px] gap-1 pointer-coarse:min-h-11",
        md: "h-8 px-4 text-[13px] gap-1.5 pointer-coarse:min-h-11",
        lg: "h-9 px-5 text-[14px] gap-1.5 pointer-coarse:min-h-11",
        "icon-compact":
          "h-7 w-7 p-0 pointer-coarse:h-11 pointer-coarse:w-11 [&_svg]:h-3.5 [&_svg]:w-3.5",
        "icon-sm":
          "h-8 w-8 p-0 pointer-coarse:h-11 pointer-coarse:w-11 [&_svg]:h-4 [&_svg]:w-4",
        icon: "h-9 w-9 p-0 pointer-coarse:h-11 pointer-coarse:w-11 [&_svg]:h-4 [&_svg]:w-4",
        "icon-lg": "h-11 w-11 p-0 [&_svg]:h-5 [&_svg]:w-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

/** Glyph geometry shared by labeled and icon controls on the 28/32/36 scale. */
export function iconSizeFor(size: VariantProps<typeof buttonVariants>["size"] = "md") {
  return size === "sm" || size === "icon-compact" ? 14 : size === "icon-lg" ? 20 : 16;
}

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  /** Count or status anchored to the control, outside its content wrapper. */
  badge?: ReactNode;
  /** Force the visual pressed/held state. Useful when the button drives an
   *  external open piece of UI (a popover, dropdown, etc.) so it reads as
   *  engaged while the menu is showing. */
  active?: boolean;
}

const bgVariants: Record<string, string> = {
  primary:
    "bg-foreground group-hover:bg-foreground/90 group-active:bg-foreground/80",
  secondary: "bg-accent group-hover:bg-accent/80 group-active:bg-accent",
  tertiary:
    "border border-border bg-transparent group-hover:bg-hover group-active:bg-active",
  ghost: "bg-transparent group-hover:bg-hover group-active:bg-active",
  destructive:
    "bg-destructive group-hover:bg-destructive/90 group-active:bg-destructive/80",
};

const activeBgVariants: Record<string, string> = {
  primary: "bg-foreground/80",
  secondary: "bg-accent",
  tertiary: "border border-border bg-active",
  ghost: "bg-active",
  destructive: "bg-destructive/80",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      badge,
      active = false,
      disabled,
      children,
      style,
      ...props
    },
    ref,
  ) => {
    // asChild: the user's element becomes the root, but the button's internal
    // structure (bg layer, content wrapper, spinner, icons) must survive. Slot
    // requires exactly one child, so instead of Slottable we clone the user's
    // element with our internals as its children — the element's own children
    // become the label inside the content wrapper.
    const asChildElement =
      asChild && isValidElement(children)
        ? (children as ReactElement<{ children?: ReactNode }>)
        : null;
    const Comp = asChildElement ? Slot : "button";
    const label = asChildElement ? asChildElement.props.children : children;
    const isIconOnly =
      size === "icon" ||
      size === "icon-compact" ||
      size === "icon-sm" ||
      size === "icon-lg";
    const iconSize = iconSizeFor(size);
    // Spinner box tracks the button height (sm is h-7, lg/icon are h-9, …) so
    // the loading glyph stays proportionate across sizes.
    const spinnerSizeClass =
      size === "sm" || size === "icon-compact"
        ? "h-7 w-7"
        : size === "lg" || size === "icon"
          ? "h-9 w-9"
          : size === "icon-lg"
            ? "h-11 w-11"
            : "h-8 w-8";
    const shape = useShape();
    const bgClass = active
      ? activeBgVariants[variant ?? "primary"]
      : bgVariants[variant ?? "primary"];

    const internals = (
      <>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-[inherit] transition-[background-color,transform] duration-80 group-active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none",
            bgClass,
          )}
        />
        <span className="relative inline-flex min-w-0 max-w-full flex-row flex-nowrap items-center justify-center gap-[inherit]">
          {loading ? (
            <>
              <span className="flex min-w-0 flex-row flex-nowrap items-center justify-center gap-[inherit] opacity-0">
                {LeadingIcon && !isIconOnly && (
                  <LeadingIcon size={iconSize} strokeWidth={2} />
                )}
                {label}
                {TrailingIcon && !isIconOnly && (
                  <TrailingIcon size={iconSize} strokeWidth={2} />
                )}
              </span>
              <span className="absolute inset-0 flex items-center justify-center">
                <svg
                  className={cn(
                    spinnerSizeClass,
                    "animate-spin motion-reduce:animate-none",
                  )}
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="1.125"
                    strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="32 68"
                  />
                </svg>
              </span>
            </>
          ) : isIconOnly ? (
            <span className="inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[1.5] [&_svg]:transition-[stroke-width] [&_svg]:duration-80 group-hover:[&_svg]:stroke-[2]">
              {label}
            </span>
          ) : (
            <>
              {LeadingIcon && (
                <LeadingIcon
                  size={iconSize}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
                />
              )}
              {/* text-box only applies to block containers, so the trim lives
                  on the label span (a blockified flex item), not the flex root.
                  The button's height is fixed (h-*), so this doesn't change
                  layout — it just centers the cap-to-baseline box optically. */}
              <span className="inline-flex min-w-0 max-w-full flex-row flex-nowrap items-center justify-center gap-[inherit] truncate whitespace-nowrap [text-box:trim-both_cap_alphabetic] [&>svg]:shrink-0">
                {label}
              </span>
              {TrailingIcon && (
                <TrailingIcon
                  size={iconSize}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
                />
              )}
            </>
          )}
        </span>
        {badge != null ? (
          <span className="pointer-events-none absolute -right-1 -top-1 z-10 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 tabular-nums text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </>
    );

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({
            variant,
            size,
          }),
          shape.button,
          className,
        )}
        // asChild roots (e.g. an anchor) don't take the disabled attribute —
        // Slot would spread it onto the element as invalid HTML.
        disabled={asChildElement ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        style={style}
        {...props}
      >
        {asChildElement
          ? cloneElement(asChildElement, undefined, internals)
          : internals}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };

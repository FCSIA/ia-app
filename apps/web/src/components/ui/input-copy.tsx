"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { Check, X } from "lucide-react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIcon, type IconComponent } from "@/lib/icon-context";
import { fontWeights } from "@/lib/font-weight";
import { useShape } from "@/lib/shape-context";
import { springs } from "@/lib/springs";

type InputCopyVariant = "icon" | "button";
type InputCopyAlign = "right" | "left";
type CopyStatus = "idle" | "copied" | "error";
type TooltipState = "idle" | "copied" | "suppressed";

interface InputCopyProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The value to display and copy to clipboard. */
  value: string;
  /** Optional label displayed above the input. */
  label?: string;
  /** Callback fired after the value is copied. */
  onCopy?: () => void;
  /** Whether the component is disabled. */
  disabled?: boolean;
  /** Display variant: icon-only with tooltip, or button with label. */
  variant?: InputCopyVariant;
  /** Position of the copy action relative to the value. */
  align?: InputCopyAlign;
}

function CopyStatusVisual({
  status,
  copyCount,
  CopyIcon,
}: {
  status: CopyStatus;
  copyCount: number;
  CopyIcon: IconComponent;
}) {
  const StatusIcon = status === "copied" ? Check : status === "error" ? X : CopyIcon;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={`${status}-${copyCount}`}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={springs.fast}
          className={cn(
            "flex items-center justify-center",
            status === "error" && "text-destructive",
          )}
        >
          <StatusIcon
            size={14}
            strokeWidth={status === "idle" ? 1.5 : 2}
            className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
          />
        </m.span>
      </AnimatePresence>
    </LazyMotion>
  );
}

function CopyAction({
  status,
  copyCount,
  variant,
  CopyIcon,
}: {
  status: CopyStatus;
  copyCount: number;
  variant: InputCopyVariant;
  CopyIcon: IconComponent;
}) {
  const statusLabel = status === "copied" ? "Copied" : status === "error" ? "Failed" : "Copy";

  return (
    <span
      className={cn(
        "shrink-0 px-1.5 py-2 text-muted-foreground transition-colors duration-80 group-hover:text-foreground",
        variant === "button" && "flex items-center gap-1.5 text-[13px]",
      )}
      style={variant === "button" ? { fontVariationSettings: fontWeights.normal } : undefined}
    >
      <CopyStatusVisual status={status} copyCount={copyCount} CopyIcon={CopyIcon} />
      {variant === "button" ? (
        <span className={cn("select-none", status === "error" && "text-destructive")}>
          {statusLabel}
        </span>
      ) : null}
    </span>
  );
}

const InputCopy = forwardRef<HTMLDivElement, InputCopyProps>(
  (
    {
      value,
      label,
      onCopy,
      disabled,
      variant = "icon",
      align = "right",
      className,
      ...props
    },
    ref,
  ) => {
    const CopyIcon = useIcon("copy");
    const shape = useShape();
    const [status, setStatus] = useState<CopyStatus>("idle");
    const [copyCount, setCopyCount] = useState(0);
    const [tooltipState, setTooltipState] = useState<TooltipState>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
    const tooltipVisibleRef = useRef(false);
    const tooltipWasVisibleRef = useRef(false);

    const copyViaExecCommand = useCallback(() => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
      return copied;
    }, [value]);

    const handleCopy = useCallback(async () => {
      if (disabled) return;

      let copied = true;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        try {
          copied = copyViaExecCommand();
        } catch {
          copied = false;
        }
      }

      setStatus(copied ? "copied" : "error");
      setCopyCount((count) => count + 1);
      setTooltipState(tooltipWasVisibleRef.current ? "copied" : "suppressed");
      if (copied) onCopy?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
        setTooltipState("suppressed");
      }, 2000);
    }, [copyViaExecCommand, disabled, onCopy, value]);

    useEffect(
      () => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      },
      [],
    );

    const action = (
      <CopyAction
        status={status}
        copyCount={copyCount}
        variant={variant}
        CopyIcon={CopyIcon}
      />
    );
    const valueElement = (
      <span
        className={cn(
          "min-w-0 flex-1 select-none truncate py-2 text-left font-mono text-[13px] text-foreground",
          align === "left" ? "pl-1" : "pl-0",
        )}
        style={{ fontVariationSettings: fontWeights.normal }}
      >
        <mark className="bg-transparent text-foreground transition-colors duration-80 group-hover:bg-[#6B97FF]/20 group-hover:text-foreground">
          {value}
        </mark>
      </span>
    );
    const statusLabel = status === "copied" ? "Copied" : status === "error" ? "Copy failed" : null;
    const button = (
      <button
        type="button"
        onPointerDown={() => {
          tooltipWasVisibleRef.current = tooltipVisibleRef.current;
        }}
        onClick={handleCopy}
        disabled={disabled}
        aria-label={statusLabel ?? (label ? `Copy ${label}` : "Copy to clipboard")}
        className={cn(
          "group flex w-full cursor-pointer items-center outline-none transition-colors duration-80",
          "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          shape.input,
        )}
      >
        {align === "left" ? action : valueElement}
        {align === "left" ? valueElement : action}
      </button>
    );

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-0.5",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onMouseEnter={() => {
          setTooltipState((current) => (current === "suppressed" ? "idle" : current));
        }}
        onMouseLeave={() => {
          setTooltipState((current) => (current === "copied" ? "suppressed" : current));
        }}
        {...props}
      >
        {label ? (
          <span
            className={cn(
              "text-[13px] text-muted-foreground",
              align === "left" ? "pl-1" : "pl-0",
            )}
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            {label}
          </span>
        ) : null}
        {variant === "icon" ? (
          <Tooltip
            content={tooltipState === "idle" ? "Copy to clipboard" : statusLabel ?? "Copied"}
            delayDuration={500}
            sideOffset={2}
            forceOpen={
              tooltipState === "copied"
                ? true
                : tooltipState === "suppressed"
                  ? false
                  : undefined
            }
            onOpenChange={(open) => {
              tooltipVisibleRef.current = open;
            }}
          >
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </div>
    );
  },
);

InputCopy.displayName = "InputCopy";

export { InputCopy };
export type { InputCopyProps };
export default InputCopy;

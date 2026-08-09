'use client';

import { animate, motion, useMotionValue, type Transition } from 'framer-motion';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
} from 'react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/springs';

type SwitchProps = Omit<
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  'onCheckedChange'
> & {
  label?: string;
  onCheckedChange: (checked: boolean) => void;
  ref?: Ref<ComponentRef<typeof SwitchPrimitive.Root>>;
  thumbTransition?: Transition;
  wrapperClassName?: string;
};

const TRACK_WIDTH = 36;
const TRACK_HEIGHT = 20;
const THUMB_SIZE = 16;
const THUMB_OFFSET = 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET * 2;
const SWITCH_ON_BACKGROUND = 'hsl(var(--primary))';
const SWITCH_ON_BACKGROUND_HOVER =
  'color-mix(in oklab, hsl(var(--primary)), hsl(var(--foreground)) 8%)';
const SWITCH_OFF_BACKGROUND =
  'color-mix(in oklab, hsl(var(--muted)), hsl(var(--foreground)) 18%)';
const SWITCH_OFF_BACKGROUND_HOVER =
  'color-mix(in oklab, hsl(var(--muted)), hsl(var(--foreground)) 24%)';

function Switch({
  'aria-label': ariaLabel,
  checked = false,
  className,
  disabled = false,
  id,
  label,
  onCheckedChange,
  ref,
  thumbTransition,
  wrapperClassName,
  ...props
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const hasMounted = useRef(false);
  const transition = thumbTransition ?? spring.fast;
  const thumbWidth = pressed ? 20 : hovered ? 18 : THUMB_SIZE;
  const thumbHeight = pressed ? 12 : THUMB_SIZE;
  const thumbX = checked
    ? THUMB_OFFSET + THUMB_TRAVEL - (thumbWidth - THUMB_SIZE)
    : THUMB_OFFSET;
  const thumbY = pressed ? 4 : THUMB_OFFSET;
  const motionX = useMotionValue(
    checked ? THUMB_OFFSET + THUMB_TRAVEL : THUMB_OFFSET,
  );

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      motionX.set(thumbX);
      return;
    }
    animate(motionX, thumbX, transition);
  }, [motionX, thumbX, transition]);

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center',
        label ? 'gap-2.5' : null,
        wrapperClassName,
      )}
    >
      <SwitchPrimitive.Root
        ref={ref}
        id={controlId}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? (label || undefined)}
        onCheckedChange={onCheckedChange}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        className={cn(
          'relative shrink-0 cursor-pointer rounded-full outline-none transition-colors duration-80',
          'focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-80',
          className,
        )}
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          backgroundColor: checked
            ? hovered
              ? SWITCH_ON_BACKGROUND_HOVER
              : SWITCH_ON_BACKGROUND
            : hovered
              ? SWITCH_OFF_BACKGROUND_HOVER
              : SWITCH_OFF_BACKGROUND,
          boxShadow: checked
            ? 'inset 0 0 0 1px hsl(var(--primary) / 0.2)'
            : 'inset 0 0 0 1px hsl(var(--foreground) / 0.28)',
        }}
        {...props}
      >
        <SwitchPrimitive.Thumb asChild>
          <motion.span
            className="absolute left-0 top-0 block rounded-full bg-white shadow-sm"
            initial={false}
            style={{ x: motionX }}
            animate={{ y: thumbY, width: thumbWidth, height: thumbHeight }}
            transition={hasMounted.current ? transition : { duration: 0 }}
          />
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
      {label ? (
        <label
          htmlFor={controlId}
          className={cn(
            'text-[13px] [text-box:trim-both_cap_alphabetic] transition-[color] duration-80',
            checked ? 'text-foreground' : 'text-muted-foreground',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          )}
        >
          {label}
        </label>
      ) : null}
    </span>
  );
}

export { Switch };
export type { SwitchProps };

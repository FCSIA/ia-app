'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Slot } from '@/components/ui/slot';
import { cn } from '@/lib/utils';

/**
 * Tactile press feedback for touch-first controls: the target dims the instant
 * a finger lands (no transition on the way down) and eases back over 200ms on
 * release, so the press reads before whatever it opens has rendered. No scale,
 * no colour change; reduced motion keeps the instant dim and drops the ease.
 *
 * Export the class for primitives that already own their element.
 */
export const PRESS_DIM =
  'touch-manipulation select-none [-webkit-tap-highlight-color:transparent] transition-opacity duration-200 ease-out active:opacity-45 active:duration-0 motion-reduce:transition-none';

type PressableProps = React.ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean;
};

export const Pressable = React.forwardRef<HTMLButtonElement, PressableProps>(
  ({ asChild = false, className, type, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        type={asChild ? type : (type ?? 'button')}
        className={cn(
          PRESS_DIM,
          'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      />
    );
  },
);
Pressable.displayName = 'Pressable';

type DisclosureTitleProps = Omit<PressableProps, 'title' | 'children'> & {
  /** Leading glyph sized to the title (1em), e.g. a channel visibility icon. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Heading element for the title; screens use h1. */
  as?: 'h1' | 'h2' | 'span';
  /** Navigates instead of acting: the title opens a page about itself. */
  href?: string;
};

/**
 * "Name ›" header control: a screen title that opens more about itself
 * (channel details, club page). One line of title, optional one-line
 * subtitle, chevron at the title's size, and the shared tactile press.
 */
export const DisclosureTitle = React.forwardRef<
  HTMLButtonElement,
  DisclosureTitleProps
>(({ icon, title, subtitle, as: Heading = 'span', href, className, ...props }, ref) => {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1 text-base font-semibold leading-tight text-foreground [&_svg]:size-[1em] [&_svg]:shrink-0">
        {icon ? <span className="flex text-muted-foreground">{icon}</span> : null}
        <Heading className="truncate">{title}</Heading>
        <ChevronRight aria-hidden className="text-muted-foreground" />
      </span>
      {subtitle ? (
        <span className="truncate text-[11px] leading-tight text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </>
  );
  const frame = cn(
    '-mx-1.5 flex min-h-11 min-w-0 flex-col justify-center px-1.5 text-left',
    className,
  );
  if (href) {
    return (
      <Pressable asChild className={frame} {...props}>
        <Link href={href}>{content}</Link>
      </Pressable>
    );
  }
  return (
    <Pressable ref={ref} className={frame} {...props}>
      {content}
    </Pressable>
  );
});
DisclosureTitle.displayName = 'DisclosureTitle';

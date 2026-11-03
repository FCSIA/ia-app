'use client';

import * as React from 'react';
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller';
import { ArrowDownIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        'group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  onScroll,
  ref,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const syncScrollEdges = React.useCallback((viewport: HTMLDivElement) => {
    const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    viewport.dataset.atScrollStart = String(viewport.scrollTop <= 1);
    viewport.dataset.atScrollEnd = String(remaining <= 1);
  }, []);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const frame = requestAnimationFrame(() => syncScrollEdges(viewport));
    const observer = new ResizeObserver(() => syncScrollEdges(viewport));
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content instanceof HTMLElement) observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [syncScrollEdges]);

  return (
    <MessageScrollerPrimitive.Viewport
      ref={(node) => {
        viewportRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      data-slot="message-scroller-viewport"
      className={cn(
        // A chat scrolls only vertically; anything wider is clipped rather than
        // letting the whole conversation pan sideways on touch screens.
        'fluid-scrollbar size-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain contain-content scroll-fade-y [scrollbar-gutter:stable]',
        className,
      )}
      onScroll={(event) => {
        syncScrollEdges(event.currentTarget);
        onScroll?.(event);
      }}
      {...props}
    />
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn('flex h-max min-h-full flex-col gap-8', className)}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn('min-w-0 shrink-0', className)}
      {...props}
    />
  );
}

function MessageScrollerButton({
  direction = 'end',
  className,
  children,
  render,
  variant = 'secondary',
  size = 'icon-sm',
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        'absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180',
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">
            {direction === 'end' ? 'Scroll to end' : 'Scroll to start'}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};

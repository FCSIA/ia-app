"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { spring } from "@/lib/springs"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

interface CollapsePanelProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Collapsible panel with a framer-motion height + spring animation.
 *
 * Radix's Content would apply `hidden` the moment a collapsible closes (it
 * can't observe the JS-driven exit animation), which is `display: none` and
 * would freeze the exit mid-flight. With `forceMount` the element stays
 * mounted and Radix's internal `hidden: !isOpen` is always false (Presence
 * reports the content as permanently present), so the attribute is entirely
 * ours to manage: we apply it only once the framer exit has actually
 * completed. `asChild` keeps our own div as the rendered element, and the
 * persistent panel keeps the trigger ↔ panel ARIA contract intact (the
 * trigger's `aria-controls` id lives on it).
 */
function CollapsePanel({ open, children, className }: CollapsePanelProps) {
  // The open height is animated to a self-measured LAYOUT pixel value, not
  // `height: "auto"`: framer resolves an "auto" target by measuring the
  // element's *visual* (transformed) size, so under a scaled ancestor
  // (e.g. /demo's 1.7x card) the animation overshoots to scale× the real
  // height and snaps back when the final "auto" lands. offsetHeight and
  // ResizeObserver are transform-immune. Same setup as the accordions.
  const shouldReduceMotion = useReducedMotion();
  const innerRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // Panels open at mount render `initial: "auto"` and receive their first
  // pixel target a commit later; that hand-off must SNAP (duration 0), not
  // spring. Panels that open later spring normally.
  const needsSnap = useRef(open);

  const measureRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    innerRef.current = el;
    if (!el) return;
    if (el.offsetHeight > 0) setContentHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => {
      // Ignore the 0 that fires while the panel is display:none.
      if (el.offsetHeight > 0) setContentHeight(el.offsetHeight);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  // Re-measure synchronously (pre-paint) when opening, so the spring's
  // target is the fresh layout height from its first frame.
  useIsoLayoutEffect(() => {
    if (open && innerRef.current && innerRef.current.offsetHeight > 0) {
      setContentHeight(innerRef.current.offsetHeight);
    }
  }, [open]);

  useEffect(() => {
    if (contentHeight !== null) needsSnap.current = false;
  }, [contentHeight]);

  const [exitComplete, setExitComplete] = useState(!open);
  if (open && exitComplete) {
    // Reset during render so the panel is un-hidden before the opening
    // animation's first paint.
    setExitComplete(false);
  }

  return (
    // Radix's --radix-collapsible-content-height/width vars are measured
    // from getBoundingClientRect (visual size) and are unused here — the
    // spring targets our own transform-immune measurement instead.
    <CollapsiblePrimitive.Content forceMount asChild hidden={!open && exitComplete}>
      <div inert={!open}>
        <motion.div
          className="overflow-hidden"
          initial={{ height: open ? "auto" : 0 }}
          animate={{ height: open ? contentHeight ?? 0 : 0 }}
          // bounce: 0 — pure height looks better without overshoot.
          transition={
            needsSnap.current || shouldReduceMotion
              ? { duration: 0 }
              : { ...spring.moderate, bounce: 0 }
          }
          onAnimationComplete={() => {
            if (!open) setExitComplete(true);
          }}
        >
          <div
            ref={measureRef}
            className={className}
          >
            {children}
          </div>
        </motion.div>
      </div>
    </CollapsiblePrimitive.Content>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsePanel }

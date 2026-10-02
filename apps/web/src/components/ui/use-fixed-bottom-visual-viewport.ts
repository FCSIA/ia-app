"use client";

import { useCallback, useLayoutEffect, useRef, type ForwardedRef } from "react";
import { getFixedBottomViewportOffset } from "@/components/layout/visual-viewport";

const OFFSET_VARIABLE = "--app-fixed-bottom-visual-viewport-offset";
const MOBILE_QUERY = "(max-width: 639px)";

/**
 * Keeps a fixed, bottom-anchored overlay inside the visual viewport when an
 * iOS keyboard leaves `position: fixed` anchored to the larger layout
 * viewport. The CSS variable is intentionally an individual `translate`, so
 * it composes with each primitive's existing transform-based animation.
 */
export function useFixedBottomVisualViewportOffset<T extends HTMLElement>(
  forwardedRef: ForwardedRef<T>,
  enabled = true,
) {
  const elementRef = useRef<T | null>(null);

  const setRef = useCallback(
    (element: T | null) => {
      elementRef.current = element;

      if (typeof forwardedRef === "function") {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [forwardedRef],
  );

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const media = window.matchMedia(MOBILE_QUERY);
    const viewport = window.visualViewport;
    let frame: number | null = null;

    const reset = () => {
      element.style.removeProperty(OFFSET_VARIABLE);
    };

    const sync = () => {
      if (frame !== null) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        frame = null;
        if (!media.matches) {
          reset();
          return;
        }

        // Measure the uncorrected fixed position. The previous correction is
        // part of getBoundingClientRect(), so it must be cleared first.
        element.style.setProperty(OFFSET_VARIABLE, "0px");
        const rect = element.getBoundingClientRect();
        const offset = getFixedBottomViewportOffset({
          elementBottom: rect.bottom,
          elementHeight: rect.height,
          viewportHeight: viewport?.height ?? window.innerHeight,
        });
        element.style.setProperty(OFFSET_VARIABLE, `${offset}px`);
      });
    };

    const observer = new ResizeObserver(sync);
    observer.observe(element);
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    media.addEventListener("change", sync);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      media.removeEventListener("change", sync);
      reset();
    };
  }, [enabled]);

  return setRef;
}

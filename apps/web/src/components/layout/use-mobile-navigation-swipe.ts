import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";

type MobileNavigationSwipeOptions = {
  onProgress?: (progress: number) => void;
  onCancel?: () => void;
};

/** Movement needed before a touch counts as a sideways swipe or a scroll. */
const AXIS_LOCK_DISTANCE = 10;

function useMobileNavigationSwipe(
  onSwipeRight: (() => void) | undefined,
  { onProgress, onCancel }: MobileNavigationSwipeOptions = {},
) {
  // `axis` is decided once the finger has moved far enough to tell a sideways
  // swipe from a scroll; a scroll never reveals the navigation.
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    at: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const swipeActionRef = useRef(onSwipeRight);

  useEffect(() => {
    swipeActionRef.current = onSwipeRight;
  }, [onSwipeRight]);

  const revealNavigationFromSwipe = (
    clientX: number,
    clientY: number,
    minimumDistance: number,
  ) => {
    const start = swipeStartRef.current;
    if (!start) return false;

    const deltaX = clientX - start.x;
    const deltaY = Math.abs(clientY - start.y);
    const elapsed = performance.now() - start.at;
    if (
      deltaX < minimumDistance ||
      deltaX <= deltaY * 1.4 ||
      deltaY > 64 ||
      elapsed > 650
    ) {
      return false;
    }

    swipeStartRef.current = null;
    swipeActionRef.current?.();
    return true;
  };

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (
      window.matchMedia("(min-width: 768px)").matches ||
      event.touches.length !== 1
    ) {
      swipeStartRef.current = null;
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.closest(
        '[data-mobile-navigation-panel], [data-swipe-navigation-ignore], input, textarea, select, [contenteditable="true"], [role="slider"], [role="tablist"]',
      )
    ) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: performance.now(),
      axis: null,
    };
  };

  const onTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const start = swipeStartRef.current;
    if (onProgress && start) {
      const deltaX = touch.clientX - start.x;
      const deltaY = Math.abs(touch.clientY - start.y);
      if (start.axis === null) {
        if (Math.max(Math.abs(deltaX), deltaY) < AXIS_LOCK_DISTANCE) return;
        start.axis = deltaX > 0 && deltaX > deltaY * 1.4 ? "x" : "y";
      }
      if (start.axis === "y") {
        swipeStartRef.current = null;
        return;
      }
      if (deltaX > 0 && deltaX > deltaY * 1.4 && deltaY <= 64) {
        onProgress(
          Math.min(1, (deltaX - AXIS_LOCK_DISTANCE) / (window.innerWidth * 0.72)),
        );
        return;
      }
    }
    // Non-interactive mobile navigation still opens before release.
    revealNavigationFromSwipe(touch.clientX, touch.clientY, 36);
  };

  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    if (onProgress) {
      const start = swipeStartRef.current;
      if (!start) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = Math.abs(touch.clientY - start.y);
      if (
        start &&
        deltaX >= window.innerWidth * 0.28 &&
        deltaX > deltaY * 1.4 &&
        deltaY <= 64
      ) {
        swipeActionRef.current?.();
      } else {
        onCancel?.();
      }
      swipeStartRef.current = null;
      return;
    }
    revealNavigationFromSwipe(touch.clientX, touch.clientY, 72);
    swipeStartRef.current = null;
  };

  const onTouchCancel = () => {
    if (!swipeStartRef.current) return;
    swipeStartRef.current = null;
    onCancel?.();
  };

  if (!onSwipeRight) return {};

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}

export { useMobileNavigationSwipe, type MobileNavigationSwipeOptions };

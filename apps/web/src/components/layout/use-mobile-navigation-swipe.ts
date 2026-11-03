import { useEffect, useRef, type RefObject } from "react";

type MobileNavigationSwipeOptions = {
  onProgress?: (progress: number) => void;
  onCancel?: () => void;
};

type MobileNavigationSwipeCallbacks = MobileNavigationSwipeOptions & {
  onSwipeRight?: () => void;
};

const AXIS_LOCK_DISTANCE = 10;
const IGNORED_TARGETS =
  '[data-mobile-navigation-panel], [data-swipe-navigation-ignore], pre, .typeset-scroll, input, textarea, select, [contenteditable="true"], [role="slider"], [role="tablist"]';

type SwipeSample = { x: number; at: number };

function recordSwipeSample(samples: SwipeSample[], x: number, at: number) {
  const last = samples[samples.length - 1];
  if (x === last.x || at <= last.at) return;

  const previous = samples[samples.length - 2];
  if (previous && Math.sign(x - last.x) !== Math.sign(last.x - previous.x)) {
    samples.splice(0, samples.length - 1);
  }
  samples.push({ x, at });
  // Retain one sample before the window to estimate motion across it.
  while (samples.length > 2 && samples[1].at < at - 80) samples.shift();
}

/** Own horizontal touches before revealing navigation, leaving scrolling to the browser. */
function attachMobileNavigationSwipe(
  surface: HTMLElement,
  getCallbacks: () => MobileNavigationSwipeCallbacks,
) {
  let start: {
    x: number;
    y: number;
    at: number;
    samples: SwipeSample[];
    claimed: boolean;
    opened: boolean;
  } | null = null;

  const cancel = () => {
    const shouldCancel = start?.claimed && !start.opened;
    start = null;
    if (shouldCancel) getCallbacks().onCancel?.();
  };

  const onTouchStart = (event: TouchEvent) => {
    cancel();
    if (
      !getCallbacks().onSwipeRight ||
      event.defaultPrevented ||
      window.matchMedia("(min-width: 768px)").matches ||
      (window.visualViewport?.scale ?? 1) > 1 ||
      event.touches.length !== 1
    ) {
      return;
    }

    const target = event.target as Element | null;
    if (target?.closest(IGNORED_TARGETS)) return;

    const touch = event.touches[0];
    const now = event.timeStamp;
    start = {
      x: touch.clientX,
      y: touch.clientY,
      at: now,
      samples: [{ x: touch.clientX, at: now }],
      claimed: false,
      opened: false,
    };
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1 || event.defaultPrevented) {
      cancel();
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (!start.claimed) {
      // Claim the first clearly rightward move, even before the reveal distance.
      // Waiting for the panel threshold lets the browser take the history gesture.
      if (deltaX > 0 && deltaX > deltaY * 1.4) {
        start.claimed = true;
      } else {
        if (Math.max(Math.abs(deltaX), deltaY) >= AXIS_LOCK_DISTANCE) {
          start = null;
        }
        return;
      }
    }

    // A non-cancelable move means the browser already owns this touch sequence.
    if (!event.cancelable) {
      cancel();
      return;
    }
    event.preventDefault();

    const { onProgress, onSwipeRight } = getCallbacks();
    if (onProgress) {
      recordSwipeSample(start.samples, touch.clientX, event.timeStamp);
      // The current panel spans the viewport, so progress maps finger movement
      // directly to the same number of pixels of panel travel.
      onProgress(Math.max(0, Math.min(1, deltaX / window.innerWidth)));
    } else if (
      !start.opened &&
      deltaX >= 36 &&
      deltaX > deltaY * 1.4 &&
      deltaY <= 64 &&
      event.timeStamp - start.at <= 650
    ) {
      start.opened = true;
      onSwipeRight?.();
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (!start) return;
    if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
      cancel();
      return;
    }

    const finished = start;
    start = null;
    if (!finished.claimed || finished.opened) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - finished.x;
    const deltaY = Math.abs(touch.clientY - finished.y);
    const { onProgress, onSwipeRight, onCancel } = getCallbacks();
    recordSwipeSample(finished.samples, touch.clientX, event.timeStamp);
    const firstSample = finished.samples[0];
    const lastSample = finished.samples[finished.samples.length - 1];
    const sampleDuration = lastSample.at - firstSample.at;
    const releaseVelocity = sampleDuration > 0
      ? (lastSample.x - firstSample.x) / sampleDuration
      : 0;
    const recentVelocity =
      onProgress && event.timeStamp - lastSample.at <= 100
        ? Math.max(-1.5, Math.min(1.5, releaseVelocity))
        : 0;
    const projectedDistance = deltaX + recentVelocity * 160;
    const minimumDistance = onProgress ? window.innerWidth * 0.28 : 72;
    if (
      (onProgress ? deltaX >= 24 && projectedDistance >= minimumDistance : deltaX >= minimumDistance) &&
      deltaX > deltaY * 1.4 &&
      deltaY <= 64 &&
      (onProgress || event.timeStamp - finished.at <= 650)
    ) {
      onSwipeRight?.();
    } else {
      onCancel?.();
    }
  };

  surface.addEventListener("touchstart", onTouchStart, { passive: true });
  // React delegates touchmove through a passive listener, where preventDefault
  // cannot stop browser navigation. Scope this native listener to the app shell.
  surface.addEventListener("touchmove", onTouchMove, { passive: false });
  surface.addEventListener("touchend", onTouchEnd, { passive: true });
  surface.addEventListener("touchcancel", cancel, { passive: true });

  return () => {
    start = null;
    surface.removeEventListener("touchstart", onTouchStart);
    surface.removeEventListener("touchmove", onTouchMove);
    surface.removeEventListener("touchend", onTouchEnd);
    surface.removeEventListener("touchcancel", cancel);
  };
}

function useMobileNavigationSwipe(
  surfaceRef: RefObject<HTMLDivElement | null>,
  onSwipeRight: (() => void) | undefined,
  { onProgress, onCancel }: MobileNavigationSwipeOptions = {},
) {
  const callbacksRef = useRef({ onSwipeRight, onProgress, onCancel });
  const enabled = Boolean(onSwipeRight);

  useEffect(() => {
    callbacksRef.current = { onSwipeRight, onProgress, onCancel };
  }, [onSwipeRight, onProgress, onCancel]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !enabled) return;
    return attachMobileNavigationSwipe(surface, () => callbacksRef.current);
  }, [surfaceRef, enabled]);
}

export {
  attachMobileNavigationSwipe,
  useMobileNavigationSwipe,
  type MobileNavigationSwipeOptions,
};

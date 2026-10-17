import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachMobileNavigationSwipe } from "./use-mobile-navigation-swipe";

class TouchSurface extends EventTarget {
  closest = vi.fn((): Element | null => null);
}

type Point = { clientX: number; clientY: number };
const point = (clientX: number, clientY = 100): Point => ({ clientX, clientY });

function touch(
  surface: TouchSurface,
  type: string,
  points: Point[],
  { cancelable = true, prevented = false } = {},
) {
  const event = new Event(type, { cancelable });
  Object.defineProperties(event, {
    touches: { value: type === "touchend" ? [] : points },
    changedTouches: { value: points },
  });
  if (prevented) event.preventDefault();
  surface.dispatchEvent(event);
  return event;
}

const detachListeners: Array<() => void> = [];

function setup(interactive = true) {
  const surface = new TouchSurface();
  const callbacks = {
    onSwipeRight: vi.fn(),
    onProgress: interactive ? vi.fn() : undefined,
    onCancel: vi.fn(),
  };
  const detach = attachMobileNavigationSwipe(
    surface as unknown as HTMLElement,
    () => callbacks,
  );
  detachListeners.push(detach);
  return { surface, callbacks, detach };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    innerWidth: 400,
    matchMedia: vi.fn(() => ({ matches: false })),
  });
});

afterEach(() => {
  detachListeners.splice(0).forEach((detach) => detach());
  vi.unstubAllGlobals();
});

describe("mobile navigation gesture ownership", () => {
  it("uses a non-passive listener and cancels the first right move before revealing", () => {
    const surface = new TouchSurface();
    const addListener = vi.spyOn(surface, "addEventListener");
    const onSwipeRight = vi.fn();
    const move = new Event("touchmove", { cancelable: true });
    const onProgress = vi.fn(() => expect(move.defaultPrevented).toBe(true));
    detachListeners.push(
      attachMobileNavigationSwipe(surface as unknown as HTMLElement, () => ({
        onSwipeRight,
        onProgress,
      })),
    );
    expect(addListener).toHaveBeenCalledWith("touchmove", expect.any(Function), {
      passive: false,
    });

    touch(surface, "touchstart", [point(2)]);
    // Inspect the cancellation from inside progress, before any panel movement.
    Object.defineProperty(move, "touches", { value: [point(6, 101)] });
    surface.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(0);

    touch(surface, "touchmove", [point(150)]);
    touch(surface, "touchend", [point(150)]);
    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it.each([point(101, 130), point(70)])(
    "leaves vertical and left gestures to the browser (%j)",
    (firstMove) => {
      const { surface, callbacks } = setup();
      touch(surface, "touchstart", [point(100)]);
      expect(touch(surface, "touchmove", [firstMove]).defaultPrevented).toBe(false);
      expect(touch(surface, "touchmove", [point(260)]).defaultPrevented).toBe(false);
      touch(surface, "touchend", [point(260)]);
      expect(callbacks.onProgress).not.toHaveBeenCalled();
      expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
    },
  );

  it("cancels a short or reversed swipe while retaining ownership until release", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(100)]);
    expect(touch(surface, "touchmove", [point(160)]).defaultPrevented).toBe(true);
    expect(touch(surface, "touchmove", [point(95)]).defaultPrevented).toBe(true);
    expect(callbacks.onProgress).toHaveBeenLastCalledWith(0);
    touch(surface, "touchend", [point(110)]);
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("does not open from a release without a claimed move", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("releases multi-touch gestures for pinch zoom and cancels partial navigation", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchmove", [point(40)]);
    expect(
      touch(surface, "touchmove", [point(80), point(200)]).defaultPrevented,
    ).toBe(false);
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("rolls back on touchcancel or when the browser already owns the movement", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchmove", [point(40)]);
    touch(surface, "touchcancel", []);
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);

    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchmove", [point(40)]);
    touch(surface, "touchmove", [point(160)], { cancelable: false });
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onCancel).toHaveBeenCalledTimes(2);
    expect(callbacks.onProgress).toHaveBeenCalledTimes(2);
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("leaves excluded controls and desktop touches unchanged", () => {
    const { surface, callbacks } = setup();
    surface.closest.mockReturnValue(surface as unknown as Element);
    touch(surface, "touchstart", [point(2)]);
    expect(touch(surface, "touchmove", [point(160)]).defaultPrevented).toBe(false);
    touch(surface, "touchend", [point(160)]);

    surface.closest.mockReturnValue(null);
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    touch(surface, "touchstart", [point(2)]);
    expect(touch(surface, "touchmove", [point(160)]).defaultPrevented).toBe(false);
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("respects a gesture already claimed by a child control", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchmove", [point(160)], { prevented: true });
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onProgress).not.toHaveBeenCalled();
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  it("uses updated callbacks without abandoning the active touch", () => {
    const { surface, callbacks } = setup();
    touch(surface, "touchstart", [point(2)]);
    touch(surface, "touchmove", [point(40)]);
    const originalAction = callbacks.onSwipeRight;
    callbacks.onSwipeRight = vi.fn();
    touch(surface, "touchmove", [point(160)]);
    touch(surface, "touchend", [point(160)]);
    expect(originalAction).not.toHaveBeenCalled();
    expect(callbacks.onSwipeRight).toHaveBeenCalledOnce();
  });

  it("keeps cancelling moves after a non-interactive sidebar opens, and opens once", () => {
    const { surface, callbacks } = setup(false);
    touch(surface, "touchstart", [point(2)]);
    expect(touch(surface, "touchmove", [point(60)]).defaultPrevented).toBe(true);
    expect(touch(surface, "touchmove", [point(160)]).defaultPrevented).toBe(true);
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onSwipeRight).toHaveBeenCalledOnce();
  });

  it("removes listeners and pending gestures when detached", () => {
    const { surface, callbacks, detach } = setup();
    touch(surface, "touchstart", [point(2)]);
    detach();
    expect(touch(surface, "touchmove", [point(160)]).defaultPrevented).toBe(false);
    touch(surface, "touchend", [point(160)]);
    expect(callbacks.onSwipeRight).not.toHaveBeenCalled();
  });
});

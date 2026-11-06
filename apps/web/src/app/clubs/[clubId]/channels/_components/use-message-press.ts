'use client';

import { useCallback, useEffect, useRef, type TouchEvent, type MouseEvent } from 'react';
import { hapticTick } from '@/lib/haptics';
import { lastScrollTime, useScrollActivity } from '@/lib/scroll-activity';

/** A hold this long opens the message's actions: a deliberate hold, quicker than iOS's own menus. */
const LONG_PRESS_MS = 420;
/** The pressed tint waits briefly so a touch that becomes a scroll never flashes a row. */
const PRESS_FEEDBACK_DELAY_MS = 70;
/** Small enough that a swipe or scroll cancels the press before its own gesture engages. */
const MOVE_SLOP_PX = 8;
/** A touch that lands while the list is still gliding only stops the scroll. */
const SCROLL_SETTLE_MS = 150;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;
const TAP_MAX_MS = 250;

/** Controls and media handle their own taps, so double-tapping them never reacts. */
const OWN_TAP_TARGETS =
  'a, button, input, textarea, select, label, [role="button"], [contenteditable="true"], [data-message-gallery], img, video';
/** Text fields keep every native gesture, including press-and-hold to edit text. */
const EDITABLE_TARGETS = 'input, textarea, select, [contenteditable="true"]';

type Press = {
  element: HTMLElement;
  x: number;
  y: number;
  startedAt: number;
  onOwnTapTarget: boolean;
  feedbackTimer: number;
  longPressTimer: number;
};

type Point = { x: number; y: number };

/**
 * React also delivers events from portaled content (a sheet or dialog opened
 * from inside the row) to the row's handlers. Only touches that started on
 * the row's own DOM belong to it.
 */
function startedInside(event: TouchEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  return event.target instanceof Element && event.currentTarget.contains(event.target);
}

/**
 * Touch handling for a chat message row: a pressed state, a long press that
 * opens the row's actions (with a haptic tick), and an optional double tap.
 * Movement, multi-touch, and scrolling cancel the press; after a long press
 * the release is swallowed so it never also taps what was under the finger.
 *
 * The pressed state is a `data-pressed` attribute set on the row directly, not
 * React state, so the feedback costs no re-render of the message.
 */
export function useMessagePress({
  enabled,
  onLongPress,
  onDoubleTap,
}: {
  enabled: boolean;
  onLongPress: () => void;
  onDoubleTap?: (point: Point) => void;
}) {
  const pressRef = useRef<Press | null>(null);
  const firedRef = useRef(false);
  const touchActiveRef = useRef(false);
  const lastTapRef = useRef<(Point & { at: number }) | null>(null);
  const callbacksRef = useRef({ onLongPress, onDoubleTap });
  useScrollActivity(enabled);

  useEffect(() => {
    callbacksRef.current = { onLongPress, onDoubleTap };
  }, [onLongPress, onDoubleTap]);

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press) {
      window.clearTimeout(press.feedbackTimer);
      window.clearTimeout(press.longPressTimer);
      delete press.element.dataset.pressed;
    }
    pressRef.current = null;
  }, []);

  const fireLongPress = useCallback(() => {
    clearPress();
    firedRef.current = true;
    lastTapRef.current = null;
    hapticTick();
    callbacksRef.current.onLongPress();
  }, [clearPress]);

  useEffect(() => {
    if (enabled) return;
    clearPress();
    firedRef.current = false;
  }, [enabled, clearPress]);

  useEffect(() => clearPress, [clearPress]);

  const handlers = {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      if (!enabled || !startedInside(event)) return;
      touchActiveRef.current = true;
      clearPress();
      firedRef.current = false;
      if (event.touches.length !== 1) return;
      const target = event.target as Element;
      if (target.closest(EDITABLE_TARGETS)) return;
      const startedAt = performance.now();
      if (startedAt - lastScrollTime() < SCROLL_SETTLE_MS) return;
      const touch = event.touches[0];
      const element = event.currentTarget;
      const press: Press = {
        element,
        x: touch.clientX,
        y: touch.clientY,
        startedAt,
        onOwnTapTarget: !!target.closest(OWN_TAP_TARGETS),
        feedbackTimer: 0,
        longPressTimer: 0,
      };
      press.feedbackTimer = window.setTimeout(() => {
        element.dataset.pressed = '';
      }, PRESS_FEEDBACK_DELAY_MS);
      press.longPressTimer = window.setTimeout(() => {
        // Any scroll since the press began means the touch was a gesture.
        if (lastScrollTime() >= startedAt) clearPress();
        else fireLongPress();
      }, LONG_PRESS_MS);
      pressRef.current = press;
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const press = pressRef.current;
      if (!press) return;
      const touch = event.touches[0];
      if (
        event.touches.length !== 1 ||
        Math.hypot(touch.clientX - press.x, touch.clientY - press.y) >= MOVE_SLOP_PX
      ) {
        clearPress();
        lastTapRef.current = null;
      }
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      if (event.touches.length === 0) touchActiveRef.current = false;
      if (firedRef.current) {
        // The hold already opened the actions; lifting the finger must not
        // also tap a link, image, or button that was under it.
        firedRef.current = false;
        if (event.cancelable) event.preventDefault();
        return;
      }
      const press = pressRef.current;
      clearPress();
      const touch = event.changedTouches[0];
      if (
        !press ||
        !touch ||
        !callbacksRef.current.onDoubleTap ||
        press.onOwnTapTarget ||
        performance.now() - press.startedAt > TAP_MAX_MS
      ) {
        lastTapRef.current = null;
        return;
      }
      const now = performance.now();
      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.at < DOUBLE_TAP_MS &&
        Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < DOUBLE_TAP_SLOP_PX
      ) {
        lastTapRef.current = null;
        if (event.cancelable) event.preventDefault();
        callbacksRef.current.onDoubleTap?.({ x: touch.clientX, y: touch.clientY });
        return;
      }
      lastTapRef.current = { x: touch.clientX, y: touch.clientY, at: now };
    },
    onTouchCancel() {
      touchActiveRef.current = false;
      firedRef.current = false;
      lastTapRef.current = null;
      clearPress();
    },
    onContextMenu(event: MouseEvent<HTMLElement>) {
      if (!enabled || !startedInside(event)) return;
      // The row's own hold replaces the browser's menu and text callouts.
      event.preventDefault();
      if (firedRef.current) return;
      const press = pressRef.current;
      if (press) {
        // Android's own long press can arrive first; it counts only while
        // ours is still intact.
        if (lastScrollTime() < press.startedAt) fireLongPress();
        return;
      }
      // A trackpad or mouse on a touch-first device.
      if (!touchActiveRef.current) callbacksRef.current.onLongPress();
    },
  };

  return handlers;
}

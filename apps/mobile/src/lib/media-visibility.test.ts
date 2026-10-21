import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('react-native', () => ({ Dimensions: { get: () => ({ width: 400, height: 800 }) } }));
import { createMediaViewport, rectanglesIntersect } from './media-visibility';

afterEach(() => vi.useRealTimers());
const measure = (rect: { x: number; y: number; width: number; height: number }) => ({
  measureInWindow: vi.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(rect.x, rect.y, rect.width, rect.height)),
});

describe('native media viewports', () => {
  test('requires actual pixels inside the clipped viewport, including tall messages', () => {
    vi.useFakeTimers();
    const viewport = createMediaViewport();
    const bounds = measure({ x: 0, y: 100, width: 400, height: 500 });
    const rect = { x: 0, y: 650, width: 200, height: 200 };
    const node = measure(rect); const visible = vi.fn();
    viewport.setViewport(bounds);
    const stop = viewport.observe(node, visible);
    vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(false);
    rect.y = 550;
    viewport.check(); vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(true);
    rect.y = 600;
    viewport.check(); vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(false);
    stop(); viewport.dispose();
  });

  test('does not treat a sheet below the screen as visible', () => {
    vi.useFakeTimers();
    const viewport = createMediaViewport(); const visible = vi.fn();
    viewport.setViewport(measure({ x: 0, y: 900, width: 400, height: 300 }));
    viewport.observe(measure({ x: 0, y: 920, width: 200, height: 200 }), visible);
    vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(false);
    viewport.dispose();
  });

  test('excludes the keyboard inset and restores visibility when it closes', () => {
    vi.useFakeTimers();
    const viewport = createMediaViewport(); const visible = vi.fn();
    viewport.setViewport(measure({ x: 0, y: 100, width: 400, height: 600 }));
    viewport.observe(measure({ x: 0, y: 500, width: 200, height: 100 }), visible);
    vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(true);
    viewport.setBottomInset(250); vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(false);
    viewport.setBottomInset(0); vi.runAllTimers();
    expect(visible).toHaveBeenLastCalledWith(true);
    viewport.dispose();
  });

  test('coalesces scroll checks and does no idle polling', () => {
    vi.useFakeTimers();
    const viewport = createMediaViewport();
    const bounds = measure({ x: 0, y: 0, width: 400, height: 600 });
    viewport.setViewport(bounds);
    const stop = viewport.observe(measure({ x: 0, y: 10, width: 100, height: 100 }), vi.fn());
    for (let index = 0; index < 30; index++) viewport.check();
    vi.runAllTimers();
    expect(bounds.measureInWindow).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10_000);
    expect(bounds.measureInWindow).toHaveBeenCalledOnce();
    viewport.check(); stop(); viewport.dispose(); vi.runAllTimers();
    expect(bounds.measureInWindow).toHaveBeenCalledOnce();
  });

  test('ignores late measurements after a recycled view is unsubscribed', () => {
    vi.useFakeTimers();
    const viewport = createMediaViewport(); const visible = vi.fn();
    let finish!: (x: number, y: number, width: number, height: number) => void;
    const node = { measureInWindow: (callback: typeof finish) => { finish = callback; } };
    viewport.setViewport(measure({ x: 0, y: 0, width: 400, height: 600 }));
    const stop = viewport.observe(node, visible); vi.runAllTimers(); stop();
    finish(0, 0, 100, 100);
    expect(visible).not.toHaveBeenCalled();
    viewport.dispose();
  });

  test('rejects zero-sized and edge-touching rectangles', () => {
    expect(rectanglesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectanglesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 0, height: 10 })).toBe(false);
  });
});

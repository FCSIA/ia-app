import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Dimensions, type View } from "react-native";

type Rect = { x: number; y: number; width: number; height: number };
export function rectanglesIntersect(a: Rect, b: Rect) {
  return a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Only visible rows register GIFs; measure those GIFs during scroll/layout, never on an idle timer. */
type Measurable = Pick<View, "measureInWindow">;
export function createMediaViewport() {
  let viewport: Measurable | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastCheck = 0;
  let bottomInset = 0;
  const entries = new Map<Measurable, (visible: boolean) => void>();
  const check = () => {
    if (timer !== undefined || !viewport || entries.size === 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      lastCheck = Date.now();
      const current = viewport;
      current?.measureInWindow((x, y, width, height) => {
        if (viewport !== current) return;
        const screen = Dimensions.get("window");
        const left = Math.max(0, x);
        const top = Math.max(0, y);
        const bounds = { x: left, y: top, width: Math.max(0, Math.min(screen.width, x + width) - left), height: Math.max(0, Math.min(screen.height, y + height - bottomInset) - top) };
        for (const [node, listener] of entries) {
          node.measureInWindow((x, y, width, height) => {
            if (viewport === current && entries.get(node) === listener) {
              listener(rectanglesIntersect(bounds, { x, y, width, height }));
            }
          });
        }
      });
    }, Math.max(0, 80 - (Date.now() - lastCheck)));
  };
  return {
    check,
    setBottomInset(value: number) { bottomInset = Math.max(0, value); check(); },
    setViewport(node: Measurable | null) { viewport = node; check(); },
    observe(node: Measurable, listener: (visible: boolean) => void) {
      entries.set(node, listener);
      check();
      return () => { entries.delete(node); };
    },
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      viewport = null;
      entries.clear();
    },
  };
}

export const MediaViewportContext = createContext<ReturnType<typeof createMediaViewport> | null>(null);
export const MediaVisibleContext = createContext(true);

export function useMediaVisibility() {
  const viewport = useContext(MediaViewportContext);
  const rowVisible = useContext(MediaVisibleContext);
  const [node, setNode] = useState<View | null>(null);
  const [intersects, setIntersects] = useState(false);
  const ref = useCallback((value: View | null) => setNode(value), []);
  useEffect(() => {
    setIntersects(false);
    if (node && viewport && rowVisible) return viewport.observe(node, setIntersects);
  }, [node, viewport, rowVisible]);
  return { ref, onLayout: viewport?.check, visible: rowVisible && (!viewport || intersects) };
}

import { describe, expect, it } from "vitest";
import { snakePoints, type Point } from "./snake-motion";

const length = (points: Point[]) => points.slice(1).reduce((sum, point, index) =>
  sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);

describe("snake motion", () => {
  it("moves continuously between cells without changing body length", () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const points = snakePoints([24, 23, 22], [25, 24, 23], 10, progress);
      expect(points[0]).toEqual({ x: 4.5 + progress, y: 2.5 });
      expect(points.at(-1)).toEqual({ x: 2.5 + progress, y: 2.5 });
      expect(length(points)).toBe(2);
    }
  });

  it("follows right-angle corners without cutting diagonally through cells", () => {
    const points = snakePoints([24, 23, 13], [34, 24, 23], 10, 0.5);
    expect(points).toEqual([
      { x: 4.5, y: 3 }, { x: 4.5, y: 2.5 },
      { x: 3.5, y: 2.5 }, { x: 3.5, y: 2 },
    ]);
    expect(length(points)).toBe(2);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
    }
  });

  it("grows by advancing the head and keeping the tail fixed", () => {
    for (const progress of [0, 0.5, 1]) {
      const points = snakePoints([24, 23, 22], [25, 24, 23, 22], 10, progress);
      expect(points.at(-1)).toEqual({ x: 2.5, y: 2.5 });
      expect(length(points)).toBe(2 + progress);
    }
  });

  it("clamps delayed frames and renders a stationary snake on mount", () => {
    const snake = [24, 23, 22];
    expect(length(snakePoints(snake, snake, 10, 1))).toBe(2);
    expect(snakePoints(snake, [25, 24, 23], 10, 2)[0]).toEqual({ x: 5.5, y: 2.5 });
    expect(snakePoints(snake, [25, 24, 23], 10, -1)[0]).toEqual({ x: 4.5, y: 2.5 });
  });
});

export type Point = { x: number; y: number };

const point = (cell: number, width: number): Point => ({ x: cell % width + 0.5, y: Math.floor(cell / width) + 0.5 });
const mix = (from: Point, to: Point, progress: number): Point => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
});

/** Follow the occupied path: corners stay put while the head and tail advance. */
export function snakePoints(previous: number[], current: number[], width: number, progress: number): Point[] {
  const amount = Math.max(0, Math.min(1, progress));
  const head = mix(point(previous[0], width), point(current[0], width), amount);
  const body = current.slice(1).map(cell => point(cell, width));
  if (current.length === previous.length) {
    const tail = mix(point(previous[previous.length - 1], width), body[body.length - 1], amount);
    return [head, ...body, tail];
  }
  // On growth, the tail stays still as one cell of new body enters the board.
  return [head, ...body];
}

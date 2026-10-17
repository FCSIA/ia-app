import { describe, expect, it } from 'vitest';
import { pickNearestProximityItem, type ProximityGeometryInput } from './proximity-hover-geometry';

const scope: ProximityGeometryInput = {
  axis: 'xy', point: { x: 0, y: 0 },
  containerRect: { left: 0, top: 0, width: 324, height: 100 },
  layoutSize: { width: 324, height: 100 },
  scroll: { x: 0, y: 0 }, border: { x: 0, y: 0 },
  rects: [
    { left: 0, top: 0, width: 161, height: 32 },
    { left: 163, top: 0, width: 161, height: 32 },
    { left: 0, top: 34, width: 161, height: 32 },
    { left: 163, top: 34, width: 161, height: 32 },
    { left: 0, top: 68, width: 324, height: 32 },
  ],
};

const pick = (x: number, y: number, overrides: Partial<ProximityGeometryInput> = {}) =>
  pickNearestProximityItem({ ...scope, point: { x, y }, ...overrides });

describe('proximity hover geometry', () => {
  it('highlights each actual option in a two-column radio layout with a full-width odd last row', () => {
    // Any / Club, Grade / Pathway, then School-wide. The old x-only
    // lookup picked the last full-width option even while hovering Grade.
    expect(pick(75, 50, { axis: 'x' })).toBe(4);
    expect([[75, 16], [240, 16], [75, 50], [240, 50], [75, 84], [240, 84]]
      .map(([x, y]) => pick(x, y))).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it('distinguishes wrapped rows whose items share the same x ranges', () => {
    expect(pick(40, 50, { rects: scope.rects.slice(0, 4) })).toBe(2);
    expect(pick(240, 16, { rects: scope.rects.slice(0, 4) })).toBe(1);
  });

  it('prefers containment over a closer center and resolves gaps by nearest center', () => {
    const rects = [
      { left: 0, top: 0, width: 300, height: 32 },
      { left: 302, top: 0, width: 20, height: 32 },
    ];
    expect(pick(299, 16, { rects })).toBe(0);
    expect(pick(301, 16, { rects })).toBe(1);
    expect(pick(162, 33, { rects: scope.rects.slice(0, 4) })).toBe(0); // Equal center distances keep the first item.
  });

  it('maps scrolled, bordered and independently scaled layout coordinates into the viewport', () => {
    // Grade: layout x=0..161/y=34..66, viewport x=94..174.5/y=160..224.
    const transformed = {
      containerRect: { left: 100, top: 80, width: 162, height: 200 },
      scroll: { x: 14, y: 8 }, border: { x: 2, y: 14 },
    };
    expect(pick(130, 192, transformed)).toBe(2);
    expect(pick(220, 124, transformed)).toBe(1);
  });

  it('preserves single-axis list behavior and handles sparse or empty registration', () => {
    expect(pick(500, 16, { axis: 'y', rects: [scope.rects[0], scope.rects[2]] })).toBe(0);
    expect(pick(240, 500, { axis: 'x', rects: scope.rects.slice(0, 2) })).toBe(1);
    expect(pick(240, 50, { rects: [undefined, scope.rects[3]] })).toBe(1);
    expect(pick(0, 0, { rects: [] })).toBeNull();
  });
});

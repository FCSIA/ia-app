import { describe, expect, test } from 'vitest';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { ancestorIds, descendantIds, flattenUnits } from './club-units';

const id = (value: string) => value as Id<'clubUnits'>;
const unit = (name: string, parent: string | null, position = 0) => ({
  _id: id(name),
  parentUnitId: parent ? id(parent) : null,
  name,
  position,
});

const units = [
  unit('house-b', null, 1),
  unit('house-a', null, 0),
  unit('room-2', 'house-a', 1),
  unit('room-1', 'house-a', 0),
  unit('team', 'room-1'),
];

describe('club unit tree', () => {
  test('lists units parents first, siblings by position then name', () => {
    expect(flattenUnits(units).map(({ unit: u, depth }) => [u.name, depth])).toEqual([
      ['house-a', 0],
      ['room-1', 1],
      ['team', 2],
      ['room-2', 1],
      ['house-b', 0],
    ]);
  });

  test('breaks position ties by name', () => {
    const tied = [unit('b', null), unit('a', null)];
    expect(flattenUnits(tied).map(({ unit: u }) => u.name)).toEqual(['a', 'b']);
  });

  test('collects a unit with everything beneath it', () => {
    expect([...descendantIds(units, id('house-a'))].sort()).toEqual(['house-a', 'room-1', 'room-2', 'team']);
    expect([...descendantIds(units, id('team'))]).toEqual(['team']);
  });

  test('walks from a unit up to its root', () => {
    expect(ancestorIds(units, id('team'))).toEqual(['team', 'room-1', 'house-a']);
  });
});

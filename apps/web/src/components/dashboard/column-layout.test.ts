import { describe, expect, it } from 'vitest';
import {
  balanceColumns,
  canImproveBalance,
  moveToColumn,
  withMobileOrder,
} from './column-layout';

describe('dashboard columns', () => {
  const state = {
    layout: ['welcome', 'a', 'b', 'c'],
    columns: [['a', 'b'], ['c']],
  };
  const heights = { a: 100, b: 100, c: 500 };

  it('keeps a manual cross-column drop even when it makes the columns less balanced', () => {
    const dropped = moveToColumn(state, 'c', 0, 1);
    expect(dropped.columns).toEqual([['a', 'c', 'b'], []]);
    expect(dropped.layout).toEqual(['welcome', 'a', 'c', 'b']);
    expect(state.columns).toEqual([['a', 'b'], ['c']]); // safe drag-cancel/Undo snapshot
    expect(
      canImproveBalance(
        dropped.columns,
        balanceColumns(dropped.columns, dropped.layout, heights),
        heights,
      ),
    ).toBe(true);
  });

  it('supports within-column ordering and dropping into an empty column', () => {
    expect(moveToColumn(state, 'b', 0, 0).columns).toEqual([['b', 'a'], ['c']]);
    const empty = { layout: ['a', 'b'], columns: [['a', 'b'], []] };
    expect(moveToColumn(empty, 'a', 1, 0).columns).toEqual([['b'], ['a']]);
  });

  it('reduces page length using measured heights, with stable ties', () => {
    const unbalanced = [['a', 'c'], ['b']];
    expect(balanceColumns(unbalanced, ['a', 'b', 'c'], heights)).toEqual([
      ['c'],
      ['a', 'b'],
    ]);
    expect(balanceColumns(state.columns, state.layout, heights)).toBe(
      state.columns,
    );
    expect(canImproveBalance(state.columns, state.columns, heights)).toBe(
      false,
    );
  });

  it('does not suggest rearranging widgets for incidental height differences', () => {
    expect(
      canImproveBalance([['a', 'b'], []], [['a'], ['b']], { a: 900, b: 1 }),
    ).toBe(false);
  });

  it('preserves desktop membership when the mobile reading order changes', () => {
    expect(withMobileOrder(state, ['welcome', 'c', 'b', 'a'])).toEqual({
      layout: ['welcome', 'c', 'b', 'a'],
      columns: [['b', 'a'], ['c']],
    });
  });
});

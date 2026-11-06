import { describe, expect, it } from 'vitest';
import { parseStoredHeights, parseStoredLayout } from './dashboard-storage';

describe('stored dashboard layout', () => {
  it('accepts the older bare id list', () => {
    expect(parseStoredLayout(['welcome', 'calendar'])).toEqual({ layout: ['welcome', 'calendar'] });
  });

  it('keeps well-formed columns and drops malformed ones', () => {
    expect(parseStoredLayout({ layout: ['a', 'b'], columns: [['a'], ['b']] })).toEqual({
      layout: ['a', 'b'],
      columns: [['a'], ['b']],
    });
    expect(parseStoredLayout({ layout: ['a'], columns: [['a']] })?.columns).toBeUndefined();
  });

  it('rejects anything that is not a layout', () => {
    expect(parseStoredLayout(null)).toBeNull();
    expect(parseStoredLayout({ layout: [1] })).toBeNull();
    expect(parseStoredLayout('x')).toBeNull();
  });
});

describe('stored widget heights', () => {
  it('keeps finite numbers only', () => {
    expect(parseStoredHeights({ '2': { a: 120, b: 'x', c: null }, '1': 5 })).toEqual({ '2': { a: 120 } });
    expect(parseStoredHeights(null)).toEqual({});
  });
});

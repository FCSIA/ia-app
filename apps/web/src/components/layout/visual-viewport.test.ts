import { describe, expect, it } from 'vitest';

import { getFixedBottomViewportOffset } from './visual-viewport';

describe('getFixedBottomViewportOffset', () => {
  it('corrects a fixed dock that is anchored to a stale, shorter viewport', () => {
    expect(
      getFixedBottomViewportOffset({
        elementBottom: 430,
        elementHeight: 64,
        viewportHeight: 844,
      }),
    ).toBe(414);
  });

  it('leaves correctly anchored navigation unchanged', () => {
    expect(
      getFixedBottomViewportOffset({
        elementBottom: 844,
        elementHeight: 64,
        viewportHeight: 844,
      }),
    ).toBe(0);
  });

  it('moves a bottom-fixed overlay above a keyboard-reduced viewport', () => {
    expect(
      getFixedBottomViewportOffset({
        elementBottom: 844,
        elementHeight: 320,
        viewportHeight: 430,
      }),
    ).toBe(-414);
  });

  it('rejects unusable measurements', () => {
    expect(
      getFixedBottomViewportOffset({
        elementBottom: 100,
        elementHeight: 0,
        viewportHeight: 844,
      }),
    ).toBe(0);
    expect(
      getFixedBottomViewportOffset({
        elementBottom: 0,
        elementHeight: 64,
        viewportHeight: 844,
      }),
    ).toBe(0);
  });
});

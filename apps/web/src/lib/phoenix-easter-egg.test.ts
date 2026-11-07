import { describe, expect, it } from 'vitest';
import { createEasterEggTapMatcher, createPhoenixEasterEggMatcher } from './phoenix-easter-egg';

function enter(matcher: (key: string, now: number) => boolean, value: string, start = 0) {
  return [...value].map((key, index) => matcher(key, start + index * 100));
}

describe('Phoenix Easter egg', () => {
  it('reveals only after the whole name is typed', () => {
    const matcher = createPhoenixEasterEggMatcher();
    expect(enter(matcher, 'PHOENIX')).toEqual([false, false, false, false, false, false, true]);
  });

  it('does not accept a wrong order or a long pause', () => {
    const matcher = createPhoenixEasterEggMatcher();
    expect(enter(matcher, 'pheonix')).not.toContain(true);
    expect(enter(matcher, 'ph', 1_000)).not.toContain(true);
    expect(enter(matcher, 'oenix', 8_000)).not.toContain(true);
  });

  it('resets after an ignored key, such as typing into a form', () => {
    const matcher = createPhoenixEasterEggMatcher();
    expect(enter(matcher, 'ph')).not.toContain(true);
    matcher('', 300);
    expect(enter(matcher, 'oenix', 400)).not.toContain(true);
  });

  it('can be discovered again without a page reload', () => {
    const matcher = createPhoenixEasterEggMatcher();
    expect(enter(matcher, 'phoenix').at(-1)).toBe(true);
    expect(enter(matcher, 'phoenix', 1_000).at(-1)).toBe(true);
  });

  it('can be found by tapping the version five times, but not with a long pause', () => {
    const tap = createEasterEggTapMatcher();
    expect([0, 100, 200, 300].map(tap)).toEqual([false, false, false, false]);
    expect(tap(2_000)).toBe(false);
    expect([2_100, 2_200, 2_300, 2_400].map(tap)).toEqual([
      false, false, false, true,
    ]);
  });
});

import { describe, expect, test } from 'vitest';
import { orbitAppearance } from './ia-orbit-mark';

describe('Orbit theme appearance', () => {
  test.each([
    ['light', 'default'],
    ['dark', 'dark'],
    ['high-contrast', 'contrast'],
    ['bubblegum', 'bubblegum'],
    ['bubblegum-dark', 'bubblegum'],
    ['custom', 'dark'],
  ] as const)('maps %s to the %s icon', (theme, appearance) => {
    expect(orbitAppearance(theme)).toBe(appearance);
  });
});

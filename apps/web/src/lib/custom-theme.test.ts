import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildCustomThemeRule,
  contrastRatio,
  customColorWarnings,
  loadCustomColors,
  parseCustomColors,
} from './custom-theme';

afterEach(() => vi.unstubAllGlobals());

describe('custom theme contrast warnings', () => {
  test('accepts the automatic custom palette', () => {
    expect(customColorWarnings({})).toEqual({});
    expect(buildCustomThemeRule({})).toBeNull();
  });

  test('warns about page text while applying the chosen colors', () => {
    const colors = { background: '#ffffff', foreground: '#eeeeee' } as const;

    expect(customColorWarnings(colors)).toMatchObject({
      background: expect.stringContaining('4.5:1'),
      foreground: expect.stringContaining('4.5:1'),
    });
    expect(buildCustomThemeRule(colors)).toContain('--background: 0 0% 100%;');
    expect(buildCustomThemeRule(colors)).toContain('--foreground: 0 0% 93%;');
  });

  test('warns about primary contrast while applying the chosen color', () => {
    const colors = {
      background: '#ffffff',
      foreground: '#000000',
      primary: '#ffffff',
    } as const;

    expect(customColorWarnings(colors)).toMatchObject({
      background: expect.stringContaining('3:1'),
      primary: expect.stringContaining('3:1'),
    });
    expect(buildCustomThemeRule(colors)).toContain('--primary: 0 0% 100%;');
  });

  test('restores low-contrast colors after reloading', () => {
    const colors = { background: '#ffffff', foreground: '#eeeeee', primary: '#ffffff' };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(colors) });
    expect(loadCustomColors()).toEqual(colors);
    expect(customColorWarnings(loadCustomColors()).foreground).toContain('4.5:1');
    expect(buildCustomThemeRule(loadCustomColors())).toContain('--primary: 0 0% 100%;');
  });

  test('checks the automatic text color when no explicit text color is set', () => {
    expect(customColorWarnings({ background: '#ffffff', primary: '#111111' }).foreground).toBeUndefined();
    expect(buildCustomThemeRule({ background: '#ffffff' })).toContain('--foreground: 0 0% 0%;');
  });

  test('still excludes malformed colors and CSS injection from saved palettes', () => {
    const colors = parseCustomColors(JSON.stringify({
      background: '#ffffff; color: red', foreground: '#EEEEEE', primary: 'nope', unknown: '#123456',
    }));
    expect(colors).toEqual({ foreground: '#eeeeee' });
    expect(buildCustomThemeRule(colors)).not.toContain('color: red');
    expect(buildCustomThemeRule({ background: 'invalid' })).toBeNull();
  });

  test('uses WCAG relative luminance', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });
});

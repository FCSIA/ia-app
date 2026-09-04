import { describe, expect, test } from 'vitest';
import {
  buildCustomThemeRule,
  contrastRatio,
  validateCustomColors,
} from './custom-theme';

describe('custom theme contrast validation', () => {
  test('accepts the automatic custom palette', () => {
    expect(validateCustomColors({})).toEqual({});
    expect(buildCustomThemeRule({})).toBeNull();
  });

  test('rejects unreadable page text', () => {
    const colors = { background: '#ffffff', foreground: '#eeeeee' } as const;

    expect(validateCustomColors(colors)).toMatchObject({
      background: expect.stringContaining('4.5:1'),
      foreground: expect.stringContaining('4.5:1'),
    });
    expect(buildCustomThemeRule(colors)).toBeNull();
  });

  test('rejects primary controls that disappear into a surface', () => {
    const colors = {
      background: '#ffffff',
      foreground: '#000000',
      primary: '#ffffff',
    } as const;

    expect(validateCustomColors(colors)).toMatchObject({
      background: expect.stringContaining('3:1'),
      primary: expect.stringContaining('3:1'),
    });
    expect(buildCustomThemeRule(colors)).toBeNull();
  });

  test('rejects a secondary surface that swallows body text', () => {
    const colors = {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#767676',
      secondary: '#eeeeee',
    } as const;

    expect(validateCustomColors(colors)).toMatchObject({
      secondary: expect.stringContaining('3:1'),
    });
    expect(buildCustomThemeRule(colors)).toBeNull();
  });

  test('rejects an accent surface that swallows body text', () => {
    const colors = {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#ffffff',
      secondary: '#5a5a5a',
      accent: '#eeeeee',
    } as const;

    expect(validateCustomColors(colors)).toMatchObject({
      accent: expect.stringContaining('3:1'),
    });
    expect(buildCustomThemeRule(colors)).toBeNull();
  });

  test('uses WCAG relative luminance', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  });
});

import { describe, expect, test } from 'vitest';
import { buildCustomThemeRule, parseCustomColors } from './custom-theme';

describe('saved palette validation', () => {
  test('excludes malformed colors and CSS injection', () => {
    const colors = parseCustomColors(JSON.stringify({
      background: '#ffffff; color: red', foreground: '#EEEEEE', primary: 'nope', unknown: '#123456',
    }));
    expect(colors).toEqual({ foreground: '#eeeeee' });
    expect(buildCustomThemeRule(colors)).not.toContain('color: red');
    expect(buildCustomThemeRule({ background: 'invalid' })).toBeNull();
  });
});

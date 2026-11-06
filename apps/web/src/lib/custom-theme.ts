import {
  blackOrWhiteOn,
  contrastRatio as contrastRatioOf,
  hexToHslToken,
  normalizeHex,
  parseHex,
} from '~/packages/design-tokens/src/color';

export const CUSTOM_COLORS_STORAGE_KEY = 'ia_custom_colors';

export const customColorSlots = [
  { key: 'background', label: 'Background', help: 'Outer page backdrop.' },
  { key: 'foreground', label: 'Text', help: 'Text over the page backdrop or wallpaper.' },
  { key: 'primary', label: 'Primary', help: 'Buttons, links, focus rings.' },
  { key: 'secondary', label: 'Secondary', help: 'Cards and inner panels.' },
  { key: 'accent', label: 'Accent', help: 'Borders, hover highlights.' },
] as const;

export type CustomColorKey = (typeof customColorSlots)[number]['key'];
export type CustomColors = Partial<Record<CustomColorKey, string>>;
export type CustomColorWarnings = Partial<Record<CustomColorKey, string>>;

const CUSTOM_COLORS_STYLE_ID = 'ia-custom-colors';
const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST = 3;
const defaultCustomColors: Record<CustomColorKey, string> = {
  background: '#090b0a',
  foreground: '#f5f6f5',
  primary: '#f97316',
  secondary: '#1d201f',
  accent: '#1d201f',
};

const colorVariables: Record<
  CustomColorKey,
  { vars: readonly string[]; automaticForegroundVars?: readonly string[] }
> = {
  background: {
    vars: ['--background'],
    automaticForegroundVars: ['--foreground'],
  },
  foreground: { vars: ['--foreground'] },
  primary: {
    vars: ['--primary', '--ring', '--sidebar-primary', '--sidebar-ring'],
    automaticForegroundVars: ['--primary-foreground'],
  },
  secondary: {
    vars: ['--secondary', '--muted', '--card', '--popover'],
    automaticForegroundVars: [
      '--secondary-foreground',
      '--muted-foreground',
      '--card-foreground',
      '--popover-foreground',
    ],
  },
  accent: {
    vars: ['--accent', '--border', '--input'],
    automaticForegroundVars: ['--accent-foreground'],
  },
};

/** Choose whichever of black or white has the greater WCAG contrast against the color. */
export function readableForegroundParts(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '0 0% 100%';
  return blackOrWhiteOn(rgb) === 'black' ? '0 0% 0%' : '0 0% 100%';
}

export function contrastRatio(left: string, right: string): number | null {
  const leftRgb = parseHex(left);
  const rightRgb = parseHex(right);
  if (!leftRgb || !rightRgb) return null;
  return contrastRatioOf(leftRgb, rightRgb);
}

export function customColorWarnings(colors: CustomColors): CustomColorWarnings {
  const resolved = Object.fromEntries(
    customColorSlots.map(({ key }) => [key, colors[key] ?? defaultCustomColors[key]]),
  ) as Record<CustomColorKey, string>;
  if (colors.background && !colors.foreground) {
    resolved.foreground = readableForegroundParts(colors.background) === '0 0% 0%'
      ? '#000000' : '#ffffff';
  }
  const warnings: CustomColorWarnings = {};
  const pageContrast = contrastRatio(resolved.foreground, resolved.background);

  if (pageContrast !== null && pageContrast < MIN_TEXT_CONTRAST) {
    const message = `Text and Background are easier to read with at least 4.5:1 contrast (currently ${pageContrast.toFixed(2)}:1).`;
    warnings.foreground = message;
    warnings.background = message;
  }

  const primaryPageContrast = contrastRatio(resolved.primary, resolved.background);
  const primaryCardContrast = contrastRatio(resolved.primary, resolved.secondary);
  if (
    (primaryPageContrast !== null && primaryPageContrast < MIN_UI_CONTRAST) ||
    (primaryCardContrast !== null && primaryCardContrast < MIN_UI_CONTRAST)
  ) {
    warnings.primary = `Primary is easier to see with at least 3:1 contrast against page and card surfaces (currently ${primaryPageContrast?.toFixed(2) ?? 'invalid'}:1 and ${primaryCardContrast?.toFixed(2) ?? 'invalid'}:1).`;
    if (primaryPageContrast !== null && primaryPageContrast < MIN_UI_CONTRAST) {
      warnings.background = warnings.background ?? warnings.primary;
    }
    if (primaryCardContrast !== null && primaryCardContrast < MIN_UI_CONTRAST) {
      warnings.secondary = warnings.primary;
    }
  }

  return warnings;
}

export function parseCustomColors(raw: string | null): CustomColors {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const colors: CustomColors = {};
    for (const { key } of customColorSlots) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value !== 'string') continue;
      const normalized = normalizeHex(value);
      if (normalized) colors[key] = normalized;
    }
    return colors;
  } catch {
    return {};
  }
}

export function loadCustomColors(): CustomColors {
  if (typeof localStorage === 'undefined') return {};
  try {
    return parseCustomColors(localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function buildCustomThemeRule(colors: CustomColors): string | null {
  const declarations: string[] = [];
  const validColors: CustomColors = {};

  for (const { key } of customColorSlots) {
    const value = colors[key];
    if (!value) continue;
    const normalized = normalizeHex(value);
    const hsl = normalized ? hexToHslToken(normalized) : null;
    if (!normalized || !hsl) continue;
    validColors[key] = normalized;
    for (const variable of colorVariables[key].vars) {
      declarations.push(`${variable}: ${hsl};`);
    }
  }

  for (const { key } of customColorSlots) {
    const value = validColors[key];
    const foregroundVars = colorVariables[key].automaticForegroundVars;
    if (!value || !foregroundVars) continue;
    if (key === 'background' && validColors.foreground) continue;
    const foreground = readableForegroundParts(value);
    for (const variable of foregroundVars) {
      declarations.push(`${variable}: ${foreground};`);
    }
  }

  return declarations.length > 0 ? `.custom { ${declarations.join(' ')} }` : null;
}

export function applyCustomColors(colors: CustomColors) {
  if (typeof document === 'undefined') return;
  const rule = buildCustomThemeRule(colors);
  const existing = document.getElementById(CUSTOM_COLORS_STYLE_ID) as HTMLStyleElement | null;

  if (!rule) {
    existing?.remove();
    return;
  }

  const style = existing ?? document.createElement('style');
  if (!existing) {
    style.id = CUSTOM_COLORS_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = rule;
}

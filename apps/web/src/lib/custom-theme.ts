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
export type CustomColorErrors = Partial<Record<CustomColorKey, string>>;

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

/** Convert a six-digit hex color to the HSL component shape used by theme variables. */
export function hexToHslParts(hex: string): string | null {
  const value = normalizedHex(hex);
  if (!value) return null;
  const r = Number.parseInt(value.slice(1, 3), 16) / 255;
  const g = Number.parseInt(value.slice(3, 5), 16) / 255;
  const b = Number.parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

/** Choose whichever of black or white has the greater WCAG contrast against the color. */
export function readableForegroundParts(hex: string): string {
  const value = normalizedHex(hex);
  if (!value) return '0 0% 100%';
  const channels = [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '0 0% 0%' : '0 0% 100%';
}

export function contrastRatio(left: string, right: string): number | null {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  if (leftLuminance === null || rightLuminance === null) return null;
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateCustomColors(colors: CustomColors): CustomColorErrors {
  const resolved = Object.fromEntries(
    customColorSlots.map(({ key }) => [key, colors[key] ?? defaultCustomColors[key]]),
  ) as Record<CustomColorKey, string>;
  const errors: CustomColorErrors = {};
  const pageContrast = contrastRatio(resolved.foreground, resolved.background);

  if (pageContrast !== null && pageContrast < MIN_TEXT_CONTRAST) {
    const message = `Text and Background need at least 4.5:1 contrast (currently ${pageContrast.toFixed(2)}:1).`;
    errors.foreground = message;
    errors.background = message;
  }

  const primaryPageContrast = contrastRatio(resolved.primary, resolved.background);
  const primaryCardContrast = contrastRatio(resolved.primary, resolved.secondary);
  if (
    (primaryPageContrast !== null && primaryPageContrast < MIN_UI_CONTRAST) ||
    (primaryCardContrast !== null && primaryCardContrast < MIN_UI_CONTRAST)
  ) {
    errors.primary = `Primary needs at least 3:1 contrast against page and card surfaces (currently ${primaryPageContrast?.toFixed(2) ?? 'invalid'}:1 and ${primaryCardContrast?.toFixed(2) ?? 'invalid'}:1).`;
    if (primaryPageContrast !== null && primaryPageContrast < MIN_UI_CONTRAST) {
      errors.background = errors.background ?? errors.primary;
    }
    if (primaryCardContrast !== null && primaryCardContrast < MIN_UI_CONTRAST) {
      errors.secondary = errors.primary;
    }
  }

  return errors;
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
      const normalized = normalizedHex(value);
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
    const colors = parseCustomColors(localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY));
    return Object.keys(validateCustomColors(colors)).length === 0 ? colors : {};
  } catch {
    return {};
  }
}

export function buildCustomThemeRule(colors: CustomColors): string | null {
  if (Object.keys(validateCustomColors(colors)).length > 0) return null;
  const declarations: string[] = [];
  const validColors: CustomColors = {};

  for (const { key } of customColorSlots) {
    const value = colors[key];
    if (!value) continue;
    const normalized = normalizedHex(value);
    const hsl = normalized ? hexToHslParts(normalized) : null;
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

function normalizedHex(value: string) {
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

function relativeLuminance(hex: string): number | null {
  const value = normalizedHex(hex);
  if (!value) return null;
  const channels = [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

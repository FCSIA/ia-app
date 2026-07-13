export type ThemeName = "light" | "dark" | "high-contrast" | "bubblegum" | "custom";

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

export const badgeColors = {
  gray: "#a3a3a3",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
} as const;

export type BadgeColor = keyof typeof badgeColors;

export const themes: Record<ThemeName, ThemeTokens> = {
  light: {
    background: "150 10% 98%",
    foreground: "150 10% 10%",
    card: "0 0% 100%",
    cardForeground: "150 10% 10%",
    popover: "0 0% 100%",
    popoverForeground: "150 10% 10%",
    primary: "22 99% 49%",
    primaryForeground: "0 0% 100%",
    secondary: "150 8% 94%",
    secondaryForeground: "150 10% 18%",
    muted: "150 8% 96%",
    mutedForeground: "150 6% 42%",
    accent: "150 8% 94%",
    accentForeground: "150 10% 18%",
    destructive: "0 72% 51%",
    destructiveForeground: "0 0% 100%",
    border: "150 8% 90%",
    input: "150 8% 90%",
    ring: "22 99% 49%",
    chart1: "215 90% 60%",
    chart2: "25 90% 58%",
    chart3: "270 65% 65%",
    chart4: "142 68% 45%",
    chart5: "45 95% 58%",
    sidebar: "150 8% 6%",
    sidebarForeground: "150 5% 82%",
    sidebarPrimary: "22 99% 52%",
    sidebarPrimaryForeground: "0 0% 100%",
    sidebarAccent: "150 6% 14%",
    sidebarAccentForeground: "0 0% 100%",
    sidebarBorder: "150 6% 14%",
    sidebarRing: "22 99% 52%",
  },
  dark: {
    background: "150 8% 4%",
    foreground: "150 5% 96%",
    card: "150 8% 7%",
    cardForeground: "150 5% 96%",
    popover: "150 8% 7%",
    popoverForeground: "150 5% 96%",
    primary: "22 99% 55%",
    primaryForeground: "0 0% 100%",
    secondary: "150 6% 12%",
    secondaryForeground: "150 5% 92%",
    muted: "150 6% 10%",
    mutedForeground: "150 5% 60%",
    accent: "150 6% 12%",
    accentForeground: "150 5% 92%",
    destructive: "0 72% 55%",
    destructiveForeground: "0 0% 100%",
    border: "150 6% 14%",
    input: "150 6% 14%",
    ring: "22 99% 55%",
    chart1: "215 90% 65%",
    chart2: "25 92% 62%",
    chart3: "270 70% 70%",
    chart4: "142 70% 55%",
    chart5: "45 95% 62%",
    sidebar: "150 10% 3%",
    sidebarForeground: "150 5% 82%",
    sidebarPrimary: "22 99% 55%",
    sidebarPrimaryForeground: "0 0% 100%",
    sidebarAccent: "150 6% 10%",
    sidebarAccentForeground: "150 5% 92%",
    sidebarBorder: "150 6% 10%",
    sidebarRing: "22 99% 55%",
  },
  "high-contrast": {
    background: "0 0% 0%",
    foreground: "0 0% 100%",
    card: "0 0% 0%",
    cardForeground: "0 0% 100%",
    popover: "0 0% 0%",
    popoverForeground: "0 0% 100%",
    primary: "48 100% 60%",
    primaryForeground: "0 0% 0%",
    secondary: "0 0% 12%",
    secondaryForeground: "0 0% 100%",
    muted: "0 0% 8%",
    mutedForeground: "0 0% 88%",
    accent: "0 0% 12%",
    accentForeground: "0 0% 100%",
    destructive: "0 100% 60%",
    destructiveForeground: "0 0% 0%",
    border: "0 0% 100%",
    input: "0 0% 100%",
    ring: "48 100% 60%",
    chart1: "48 100% 60%",
    chart2: "0 100% 60%",
    chart3: "120 100% 60%",
    chart4: "200 100% 60%",
    chart5: "300 100% 70%",
    sidebar: "0 0% 0%",
    sidebarForeground: "0 0% 100%",
    sidebarPrimary: "48 100% 60%",
    sidebarPrimaryForeground: "0 0% 0%",
    sidebarAccent: "0 0% 12%",
    sidebarAccentForeground: "0 0% 100%",
    sidebarBorder: "0 0% 100%",
    sidebarRing: "48 100% 60%",
  },
  bubblegum: {
    background: "335 90% 92%",
    foreground: "330 55% 14%",
    card: "340 80% 97%",
    cardForeground: "330 55% 14%",
    popover: "340 80% 97%",
    popoverForeground: "330 55% 14%",
    primary: "328 92% 54%",
    primaryForeground: "0 0% 100%",
    secondary: "335 85% 86%",
    secondaryForeground: "330 55% 20%",
    muted: "335 80% 90%",
    mutedForeground: "330 30% 36%",
    accent: "290 75% 82%",
    accentForeground: "290 50% 22%",
    destructive: "0 80% 55%",
    destructiveForeground: "0 0% 100%",
    border: "330 70% 78%",
    input: "330 70% 78%",
    ring: "328 92% 54%",
    chart1: "328 92% 58%",
    chart2: "290 78% 60%",
    chart3: "200 82% 58%",
    chart4: "45 95% 58%",
    chart5: "150 62% 50%",
    sidebar: "330 50% 20%",
    sidebarForeground: "340 100% 96%",
    sidebarPrimary: "328 95% 65%",
    sidebarPrimaryForeground: "0 0% 100%",
    sidebarAccent: "330 38% 26%",
    sidebarAccentForeground: "0 0% 100%",
    sidebarBorder: "330 30% 32%",
    sidebarRing: "328 95% 65%",
  },
  custom: {
    background: "150 8% 4%",
    foreground: "150 5% 96%",
    card: "150 8% 7%",
    cardForeground: "150 5% 96%",
    popover: "150 8% 7%",
    popoverForeground: "150 5% 96%",
    primary: "22 99% 55%",
    primaryForeground: "0 0% 100%",
    secondary: "150 6% 12%",
    secondaryForeground: "150 5% 92%",
    muted: "150 6% 10%",
    mutedForeground: "150 5% 60%",
    accent: "150 6% 12%",
    accentForeground: "150 5% 92%",
    destructive: "0 72% 55%",
    destructiveForeground: "0 0% 100%",
    border: "150 6% 14%",
    input: "150 6% 14%",
    ring: "22 99% 55%",
    chart1: "215 90% 65%",
    chart2: "25 92% 62%",
    chart3: "270 70% 70%",
    chart4: "142 70% 55%",
    chart5: "45 95% 62%",
    sidebar: "150 10% 3%",
    sidebarForeground: "150 5% 82%",
    sidebarPrimary: "22 99% 55%",
    sidebarPrimaryForeground: "0 0% 100%",
    sidebarAccent: "150 6% 10%",
    sidebarAccentForeground: "150 5% 92%",
    sidebarBorder: "150 6% 10%",
    sidebarRing: "22 99% 55%",
  },
};

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
  card: 22,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

export const typography = {
  fontFamily: "WorkSans",
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    "2xl": 32,
  },
} as const;

export function hsl(token: string) {
  const [h, s, l] = parseHsl(token);
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r}, ${g}, ${b})`;
}

export function hsla(token: string, alpha: number) {
  const [h, s, l] = parseHsl(token);
  const [r, g, b] = hslToRgb(h, s, l);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHsl(token: string) {
  const [h = "0", s = "0%", l = "0%"] = token.split(/\s+/);
  return [
    Number(h),
    Number(s.replace("%", "")) / 100,
    Number(l.replace("%", "")) / 100,
  ] as const;
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const [r1, g1, b1] =
    huePrime < 1 ? [chroma, x, 0] :
    huePrime < 2 ? [x, chroma, 0] :
    huePrime < 3 ? [0, chroma, x] :
    huePrime < 4 ? [0, x, chroma] :
    huePrime < 5 ? [x, 0, chroma] :
    [chroma, 0, x];
  const m = lightness - chroma / 2;
  return [r1, g1, b1].map((value) => Math.round((value + m) * 255));
}

export const theme = {
  colors: {
    background: '#fffaf5',
    backgroundSoft: '#fff4e8',
    surface: '#ffffff',
    surfaceMuted: '#fffdf9',
    text: '#111827',
    textSoft: '#374151',
    textMuted: '#6b7280',
    textFaint: '#9ca3af',
    border: 'rgba(15, 23, 42, 0.08)',
    borderStrong: 'rgba(15, 23, 42, 0.14)',
    accent: '#f97316',
    accentDark: '#ea580c',
    accentSoft: 'rgba(249, 115, 22, 0.12)',
    accentGlow: 'rgba(249, 115, 22, 0.28)',
    blue: '#2563eb',
    blueSoft: 'rgba(37, 99, 235, 0.12)',
    green: '#16a34a',
    greenSoft: 'rgba(22, 163, 74, 0.14)',
    amber: '#d97706',
    amberSoft: 'rgba(217, 119, 6, 0.15)',
    red: '#dc2626',
    redSoft: 'rgba(220, 38, 38, 0.12)',
    shadow: 'rgba(15, 23, 42, 0.12)',
    overlay: 'rgba(17, 24, 39, 0.45)',
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    pill: 999,
  },
  spacing: {
    screen: 20,
    section: 24,
    gap: 14,
  },
  shadow: {
    card: {
      shadowColor: '#0f172a',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    glow: {
      shadowColor: '#f97316',
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
} as const;

export const statusTones = {
  success: {
    backgroundColor: theme.colors.greenSoft,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    color: theme.colors.green,
  },
  info: {
    backgroundColor: theme.colors.blueSoft,
    borderColor: 'rgba(37, 99, 235, 0.22)',
    color: theme.colors.blue,
  },
  warning: {
    backgroundColor: theme.colors.amberSoft,
    borderColor: 'rgba(217, 119, 6, 0.22)',
    color: theme.colors.amber,
  },
  danger: {
    backgroundColor: theme.colors.redSoft,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    color: theme.colors.red,
  },
  neutral: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.14)',
    color: theme.colors.textSoft,
  },
} as const;

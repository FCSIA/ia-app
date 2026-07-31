import { radii, spacing, typography } from "@ia/design-tokens";

export { radii, spacing, typography };

export const text = {
  display: { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  title: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  section: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "500", lineHeight: 22 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
  overline: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
} as const;

export const elevation = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  sm: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
} as const;

export const duration = { fast: 150, base: 220, slow: 320 } as const;

/**
 * Task-level density, not a global display preference.
 *
 * Compact geometry is intentionally smaller than the minimum touch target.
 * Interactive primitives should expand their hit area to `touchTarget` rather
 * than making every visible row or control 44px tall.
 */
export const densityMetrics = {
  compact: {
    visualControlHeight: 36,
    rowMinHeight: 40,
    touchTarget: 44,
    sectionHeaderHeight: 32,
    horizontalInset: spacing.sm,
    contentGap: spacing.sm,
    verticalGap: spacing.xs,
    iconSize: 18,
    radius: 8,
  },
  default: {
    visualControlHeight: 44,
    rowMinHeight: 48,
    touchTarget: 44,
    sectionHeaderHeight: 36,
    horizontalInset: spacing.md,
    contentGap: 10,
    verticalGap: spacing.sm,
    iconSize: 20,
    radius: radii.sm,
  },
  comfortable: {
    visualControlHeight: 48,
    rowMinHeight: 56,
    touchTarget: 48,
    sectionHeaderHeight: 40,
    horizontalInset: spacing.lg,
    contentGap: spacing.md,
    verticalGap: spacing.md,
    iconSize: 22,
    radius: radii.md,
  },
} as const;

export type Density = keyof typeof densityMetrics;

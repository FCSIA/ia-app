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

import type { Config } from "tailwindcss";
import { themes } from "@ia/design-tokens";

const light = themes.light;
const hsl = (token: string) => `hsl(${token.replaceAll(" ", ", ")})`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: hsl(light.background),
        foreground: hsl(light.foreground),
        card: hsl(light.card),
        "card-foreground": hsl(light.cardForeground),
        primary: hsl(light.primary),
        "primary-foreground": hsl(light.primaryForeground),
        secondary: hsl(light.secondary),
        "secondary-foreground": hsl(light.secondaryForeground),
        muted: hsl(light.muted),
        "muted-foreground": hsl(light.mutedForeground),
        accent: hsl(light.accent),
        "accent-foreground": hsl(light.accentForeground),
        destructive: hsl(light.destructive),
        border: hsl(light.border)
      },
      borderRadius: {
        sm: 12,
        md: 14,
        lg: 16,
        xl: 20,
        "2xl": 22,
        full: 999
      },
      fontFamily: {
        sans: ["WorkSans"]
      }
    }
  },
  plugins: []
} satisfies Config;

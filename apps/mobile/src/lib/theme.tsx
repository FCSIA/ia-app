import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { themes, hsl, type ThemeName, type ThemeTokens } from "@ia/design-tokens";

type ThemeContextValue = {
  name: ThemeName;
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
  color: (key: keyof ThemeTokens) => string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<ThemeName>("light");
  const tokens = themes[name];
  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      tokens,
      setTheme: setName,
      color: (key) => hsl(tokens[key])
    }),
    [name, tokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}

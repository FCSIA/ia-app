import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes, hsl, type ThemeName, type ThemeTokens } from "@ia/design-tokens";

type ThemeContextValue = {
  name: ThemeName;
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
  color: (key: keyof ThemeTokens) => string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "ia_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<ThemeName>("light");
  const tokens = themes[name];

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored && stored in themes) setName(stored as ThemeName);
    });
  }, []);

  function setTheme(next: ThemeName) {
    setName(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      tokens,
      setTheme,
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

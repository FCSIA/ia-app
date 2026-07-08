import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes, hsl, type ThemeName, type ThemeTokens } from "@ia/design-tokens";

type ThemeContextValue = {
  name: ThemeName;
  tokens: ThemeTokens;
  setTheme: (name: ThemeName) => void;
  setCustomTokens: (tokens: ThemeTokens) => void;
  updateCustomToken: (key: keyof ThemeTokens, value: string) => void;
  color: (key: keyof ThemeTokens) => string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "ia_theme";
const CUSTOM_THEME_STORAGE_KEY = "ia_custom_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<ThemeName>("light");
  const [customTokens, setCustomTokensState] = useState<ThemeTokens>(themes.custom);
  const tokens = name === "custom" ? customTokens : themes[name];

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored && stored in themes) setName(stored as ThemeName);
    });
    AsyncStorage.getItem(CUSTOM_THEME_STORAGE_KEY).then((stored) => {
      const parsed = parseStoredTheme(stored);
      if (parsed) setCustomTokensState(parsed);
    });
  }, []);

  function setTheme(next: ThemeName) {
    setName(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }

  function setCustomTokens(next: ThemeTokens) {
    setCustomTokensState(next);
    setName("custom");
    AsyncStorage.multiSet([
      [THEME_STORAGE_KEY, "custom"],
      [CUSTOM_THEME_STORAGE_KEY, JSON.stringify(next)],
    ]).catch(() => {});
  }

  function updateCustomToken(key: keyof ThemeTokens, value: string) {
    setCustomTokens({ ...customTokens, [key]: value });
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      tokens,
      setTheme,
      setCustomTokens,
      updateCustomToken,
      color: (key) => hsl(tokens[key])
    }),
    [customTokens, name, tokens]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider.");
  return context;
}

function parseStoredTheme(stored: string | null) {
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<ThemeTokens>;
    const complete = { ...themes.custom, ...parsed };
    return complete;
  } catch {
    return null;
  }
}

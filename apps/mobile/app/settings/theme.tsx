import { useMemo, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { Check, RotateCcw } from "lucide-react-native";
import { hsl, themes, type ThemeName, type ThemeTokens } from "@ia/design-tokens";
import { Screen } from "@/components/screen";
import { Button, PressableScale, Section, TextField, Txt, Switch, ListRow, useToast } from "@/components/ui";
import { useGifAutoplay } from "@/lib/gif-playback";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

const names = Object.keys(themes) as ThemeName[];
const editableColors = [
  { key: "background", label: "Background" },
  { key: "card", label: "Surface" },
  { key: "foreground", label: "Text" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
] as const;

const themeLabels: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  "high-contrast": "High contrast",
  bubblegum: "Bubblegum",
  "bubblegum-dark": "Bubblegum Dark",
  custom: "Custom",
};

const swatches = [
  "#f8fafc",
  "#111827",
  "#f97316",
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#facc15",
  "#ef4444",
] as const;

export default function ThemeScreen() {
  const { autoplay, setAutoplay } = useGifAutoplay();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const isWide = width >= 720;
  const [draftHex, setDraftHex] = useState<Record<string, string>>(() => makeDraft(theme.customTokens));
  const customPreview = useMemo(() => {
    const next = { ...theme.customTokens };
    for (const item of editableColors) {
      const token = hexToHslToken(draftHex[item.key]);
      if (token) next[item.key] = token;
    }
    applyReadablePairs(next);
    return next;
  }, [draftHex, theme.customTokens]);

  function selectTheme(name: ThemeName) {
    theme.setTheme(name);
    if (name === "custom") setDraftHex(makeDraft(theme.customTokens));
  }

  function updateDraft(key: keyof ThemeTokens, hexValue: string) {
    setDraftHex((current) => ({ ...current, [key]: normalizeHexInput(hexValue) }));
  }

  function saveCustom() {
    theme.setCustomTokens(customPreview);
    setDraftHex(makeDraft(customPreview));
    showToast({ title: "Custom theme saved", tone: "success" });
  }

  function resetCustom() {
    theme.setCustomTokens(themes.custom);
    setDraftHex(makeDraft(themes.custom));
    showToast({ title: "Custom theme reset", tone: "success" });
  }

  return (
    <Screen
      title="Appearance"
      contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center", gap: spacing.xl }}
    >
      <Section title="Animations">
        <ListRow title="Autoplay GIFs" subtitle="Play automatically on this device. Turn off to start paused. Reduced motion starts paused; individual play buttons still work." trailing={
          <Switch label="Autoplay GIFs" value={autoplay} onValueChange={(next) => {
            void setAutoplay(next).catch(() => showToast({ title: 'Could not save playback preference', tone: 'warning' }));
          }} />
        } />
      </Section>
      <Section title="Theme">
        <View
          accessibilityRole="radiogroup"
          style={{
            overflow: "hidden",
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: theme.color("border"),
            backgroundColor: theme.color("card"),
          }}
        >
          {names.map((name, index) => {
            const tokens = name === "custom" ? customPreview : themes[name];
            const selected = theme.name === name;
            return (
              <PressableScale
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={`${themeLabels[name]} theme`}
                accessibilityState={{ checked: selected, selected }}
                onPress={() => selectTheme(name)}
                style={{
                  minHeight: 64,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: theme.color("border"),
                }}
              >
                <Txt numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>
                  {themeLabels[name]}
                </Txt>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ flexDirection: "row", gap: spacing.xs }}
                >
                  {(["background", "card", "primary", "foreground"] as const).map((key) => (
                    <ColorPreview
                      key={key}
                      color={hsl(tokens[key])}
                      border={hsl(tokens.border)}
                      size={20}
                    />
                  ))}
                </View>
                <View style={{ width: 24, alignItems: "center" }}>
                  {selected ? <Check size={19} strokeWidth={2.5} color={theme.color("primary")} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Section>

      <Section title="Custom colors">
        <Txt tone="muted">Choose a swatch or enter a hex value. Save to apply the theme.</Txt>
        <View>
          {editableColors.map((item, index) => (
            <ColorEditor
              key={item.key}
              label={item.label}
              value={draftHex[item.key]}
              preview={hexToRgb(draftHex[item.key]) ?? hsl(customPreview[item.key])}
              isWide={isWide}
              separated={index > 0}
              border={theme.color("border")}
              errorBorder={theme.color("destructive")}
              selectedBorder={theme.color("primary")}
              onChange={(value) => updateDraft(item.key, value)}
              onSwatch={(value) => updateDraft(item.key, value)}
            />
          ))}
        </View>

        <ThemePreview tokens={customPreview} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <Button title="Save custom" onPress={saveCustom} style={{ flexGrow: 1, minWidth: 180 }} />
          <Button
            title="Reset"
            variant="tertiary"
            icon={RotateCcw}
            onPress={resetCustom}
            style={{ minWidth: 112 }}
          />
        </View>
      </Section>
    </Screen>
  );
}

function ColorEditor({
  label,
  value,
  preview,
  isWide,
  separated,
  border,
  errorBorder,
  selectedBorder,
  onChange,
  onSwatch,
}: {
  label: string;
  value: string;
  preview: string;
  isWide: boolean;
  separated: boolean;
  border: string;
  errorBorder: string;
  selectedBorder: string;
  onChange: (value: string) => void;
  onSwatch: (value: string) => void;
}) {
  const isValid = parseHex(value) !== null;
  const normalizedValue = normalizeHexInput(value).toLowerCase();

  return (
    <View
      style={{
        flexDirection: isWide ? "row" : "column",
        alignItems: isWide ? "flex-start" : "stretch",
        gap: spacing.lg,
        paddingVertical: spacing.lg,
        borderTopWidth: separated ? 1 : 0,
        borderTopColor: border,
      }}
    >
      <View style={{ width: isWide ? 232 : "100%", flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <ColorPreview color={preview} border={border} size={44} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Txt variant="label">{label}</Txt>
          <TextField
            accessibilityLabel={`${label} hex value`}
            accessibilityHint="Enter three or six hexadecimal digits."
            value={value}
            onChangeText={onChange}
            placeholder="#f97316"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ minHeight: 44, borderColor: isValid ? border : errorBorder }}
          />
          {!isValid ? (
            <Txt variant="caption" tone="destructive">
              Enter 3 or 6 hex digits.
            </Txt>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
        {swatches.map((swatch) => (
          <ColorSwatch
            key={swatch}
            color={swatch}
            selected={normalizedValue === swatch}
            border={border}
            selectedBorder={selectedBorder}
            onPress={() => onSwatch(swatch)}
          />
        ))}
      </View>
    </View>
  );
}

function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  return (
    <View
      accessible
      accessibilityLabel="Custom theme preview"
      style={{
        overflow: "hidden",
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: hsl(tokens.border),
        backgroundColor: hsl(tokens.background),
        padding: spacing.lg,
      }}
    >
      <View
        style={{
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: hsl(tokens.border),
          backgroundColor: hsl(tokens.card),
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <Txt variant="label" style={{ color: hsl(tokens.cardForeground) }}>
            Preview
          </Txt>
          <Txt style={{ color: hsl(tokens.cardForeground) }}>Tomorrow's schedule is ready.</Txt>
          <Txt variant="caption" style={{ color: hsl(tokens.mutedForeground) }}>
            Four classes · First period at 8:55 AM
          </Txt>
        </View>
        <View
          style={{
            alignSelf: "flex-start",
            minHeight: 44,
            borderRadius: radii.md,
            backgroundColor: hsl(tokens.primary),
            paddingHorizontal: spacing.lg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt variant="label" style={{ color: hsl(tokens.primaryForeground) }}>
            View schedule
          </Txt>
        </View>
      </View>
    </View>
  );
}

function ColorPreview({ color, border, size }: { color: string; border: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: color,
      }}
    />
  );
}

function ColorSwatch({
  color,
  selected,
  border,
  selectedBorder,
  onPress,
}: {
  color: string;
  selected: boolean;
  border: string;
  selectedBorder: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityLabel={`Use ${color}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radii.pill,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? selectedBorder : border,
          backgroundColor: color,
        }}
      />
    </PressableScale>
  );
}

function makeDraft(tokens: ThemeTokens) {
  return Object.fromEntries(editableColors.map((item) => [item.key, hslTokenToHex(tokens[item.key])])) as Record<string, string>;
}

function normalizeHexInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function hexToHslToken(value: string) {
  const rgb = parseHex(value);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslTokenToHex(token: string) {
  const [h = "0", s = "0%", l = "0%"] = token.split(/\s+/);
  const { r, g, b } = hslToRgb(Number(h), Number(s.replace("%", "")) / 100, Number(l.replace("%", "")) / 100);
  return rgbToHex(r, g, b);
}

function hexToRgb(value: string) {
  const rgb = parseHex(value);
  return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null;
}

function parseHex(value: string) {
  const match = normalizeHexInput(value).match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!match) return null;
  const raw = match[1];
  const hexValue = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  return {
    r: Number.parseInt(hexValue.slice(0, 2), 16),
    g: Number.parseInt(hexValue.slice(2, 4), 16),
    b: Number.parseInt(hexValue.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const h =
    max === r1 ? ((g1 - b1) / delta + (g1 < b1 ? 6 : 0)) * 60 :
    max === g1 ? ((b1 - r1) / delta + 2) * 60 :
    ((r1 - g1) / delta + 4) * 60;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const [r1, g1, b1] =
    huePrime < 1 ? [chroma, x, 0] :
    huePrime < 2 ? [x, chroma, 0] :
    huePrime < 3 ? [0, chroma, x] :
    huePrime < 4 ? [0, x, chroma] :
    huePrime < 5 ? [x, 0, chroma] :
    [chroma, 0, x];
  const m = l - chroma / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function applyReadablePairs(tokens: ThemeTokens) {
  tokens.primaryForeground = readableForeground(tokens.primary);
  tokens.accentForeground = readableForeground(tokens.accent);
  tokens.cardForeground = tokens.foreground;
  tokens.popover = tokens.card;
  tokens.popoverForeground = tokens.foreground;
  tokens.secondary = soften(tokens.card, tokens.background);
  tokens.secondaryForeground = tokens.foreground;
  tokens.muted = soften(tokens.card, tokens.background);
  tokens.mutedForeground = readableMuted(tokens.foreground, tokens.background);
  tokens.border = soften(tokens.foreground, tokens.background);
  tokens.input = tokens.border;
  tokens.ring = tokens.primary;
  tokens.sidebar = tokens.background;
  tokens.sidebarForeground = tokens.foreground;
  tokens.sidebarPrimary = tokens.primary;
  tokens.sidebarPrimaryForeground = tokens.primaryForeground;
  tokens.sidebarAccent = tokens.accent;
  tokens.sidebarAccentForeground = tokens.accentForeground;
  tokens.sidebarBorder = tokens.border;
  tokens.sidebarRing = tokens.primary;
}

function readableForeground(token: string) {
  const hex = hslTokenToHex(token);
  const rgb = parseHex(hex);
  if (!rgb) return "0 0% 100%";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? "150 10% 10%" : "0 0% 100%";
}

function readableMuted(foreground: string, background: string) {
  const fg = rgbToHslFromToken(foreground);
  const bg = rgbToHslFromToken(background);
  return `${Math.round(fg.h)} ${Math.round(fg.s * 100)}% ${bg.l > 0.5 ? "38%" : "66%"}`;
}

function soften(foreground: string, background: string) {
  const fg = rgbToHslFromToken(foreground);
  const bg = rgbToHslFromToken(background);
  return `${Math.round(fg.h)} ${Math.round(Math.min(fg.s, 0.18) * 100)}% ${bg.l > 0.5 ? "92%" : "14%"}`;
}

function rgbToHslFromToken(token: string) {
  const hex = hslTokenToHex(token);
  const rgb = parseHex(hex) ?? { r: 0, g: 0, b: 0 };
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

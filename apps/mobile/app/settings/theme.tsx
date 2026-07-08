import { useMemo, useState } from "react";
import { View } from "react-native";
import { Check, RotateCcw } from "lucide-react-native";
import { hsl, themes, type ThemeName, type ThemeTokens } from "@ia/design-tokens";
import { Screen } from "@/components/screen";
import { Button, Card, PressableScale, Section, TextField, Txt, useToast } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

const names = Object.keys(themes) as ThemeName[];
const editableColors = [
  { key: "background", label: "Background" },
  { key: "card", label: "Cards" },
  { key: "foreground", label: "Text" },
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
] as const;

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
  const theme = useTheme();
  const { showToast } = useToast();
  const [draftHex, setDraftHex] = useState<Record<string, string>>(() => makeDraft(theme.tokens));
  const customPreview = useMemo(() => {
    const next = { ...theme.tokens };
    for (const item of editableColors) {
      const token = hexToHslToken(draftHex[item.key]);
      if (token) next[item.key] = token;
    }
    applyReadablePairs(next);
    return next;
  }, [draftHex, theme.tokens]);

  function selectTheme(name: ThemeName) {
    theme.setTheme(name);
    setDraftHex(makeDraft(name === "custom" ? theme.tokens : themes[name]));
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
    <Screen title="Theme" subtitle="Choose a theme or tune your own custom colors.">
      <Section title="Themes">
        {names.map((name) => (
          <Card
            key={name}
            onPress={() => selectTheme(name)}
            style={{
              gap: spacing.sm,
              borderColor: theme.name === name ? theme.color("primary") : theme.color("border"),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Txt variant="section" style={{ flex: 1, textTransform: "capitalize" }}>
                {name.replace("-", " ")}
              </Txt>
              {theme.name === name ? <Check size={20} color={theme.color("primary")} /> : null}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["background", "primary", "accent", "foreground"] as const).map((key) => (
                <ColorDot key={key} color={hsl(name === "custom" ? theme.tokens[key] : themes[name][key])} border={theme.color("border")} />
              ))}
            </View>
          </Card>
        ))}
      </Section>

      <Section title="Custom Colors">
        <Card style={{ gap: spacing.md }}>
          <Txt tone="muted">Pick swatches or enter hex values. Saving switches the app to Custom.</Txt>
          {editableColors.map((item) => (
            <ColorEditor
              key={item.key}
              label={item.label}
              value={draftHex[item.key]}
              preview={hexToRgb(draftHex[item.key]) ?? hsl(customPreview[item.key])}
              onChange={(value) => updateDraft(item.key, value)}
              onSwatch={(value) => updateDraft(item.key, value)}
            />
          ))}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button title="Save custom" onPress={saveCustom} style={{ flex: 1 }} />
            <Button title="Reset" variant="tertiary" icon={RotateCcw} onPress={resetCustom} />
          </View>
        </Card>

        <Card style={{ gap: spacing.sm, backgroundColor: hsl(customPreview.background), borderColor: hsl(customPreview.border) }}>
          <Txt variant="section" style={{ color: hsl(customPreview.foreground) }}>Preview</Txt>
          <View style={{ borderRadius: 14, backgroundColor: hsl(customPreview.card), padding: spacing.md, gap: spacing.sm }}>
            <Txt style={{ color: hsl(customPreview.foreground) }}>Cards, text, and buttons update from your custom colors.</Txt>
            <View style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: hsl(customPreview.primary), paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Txt variant="label" style={{ color: hsl(customPreview.primaryForeground) }}>Primary action</Txt>
            </View>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

function ColorEditor({
  label,
  value,
  preview,
  onChange,
  onSwatch,
}: {
  label: string;
  value: string;
  preview: string;
  onChange: (value: string) => void;
  onSwatch: (value: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <ColorDot color={preview} border="rgba(127, 127, 127, 0.35)" />
        <View style={{ flex: 1 }}>
          <Txt variant="label">{label}</Txt>
          <Txt variant="caption" tone="muted">Custom color</Txt>
        </View>
      </View>
      <TextField value={value} onChangeText={onChange} placeholder="#f97316" autoCapitalize="none" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {swatches.map((swatch) => (
          <ColorDot key={swatch} color={swatch} border="rgba(127, 127, 127, 0.35)" onPress={() => onSwatch(swatch)} />
        ))}
      </View>
    </View>
  );
}

function ColorDot({ color, border, onPress }: { color: string; border: string; onPress?: () => void }) {
  const dot = (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: color,
      }}
    />
  );
  if (!onPress) return dot;
  return <PressableScale accessibilityLabel={`Use ${color}`} onPress={onPress}>{dot}</PressableScale>;
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

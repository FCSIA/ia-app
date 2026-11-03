import { describe, expect, it } from "vitest";
import { themes, type ThemeTokens } from "@ia/design-tokens";
import { announcementUnreadColors } from "./unread-colors";

describe("announcementUnreadColors", () => {
  it("chooses the surface furthest from each built-in theme background", () => {
    expect(announcementUnreadColors(themes.light).surface).toBe("secondary");
    expect(announcementUnreadColors(themes.dark).surface).toBe("accent");
    expect(announcementUnreadColors(themes.bubblegum).surface).toBe("accent");
  });

  it("keeps foreground and icon contrast readable across every built-in theme", () => {
    for (const tokens of Object.values(themes)) {
      const colors = announcementUnreadColors(tokens);
      expect(contrastRatio(colors.background, colors.foreground)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.background, colors.mutedForeground)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.background, colors.icon)).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not assume unread surfaces must be darker or lighter", () => {
    const lightCustom: ThemeTokens = {
      ...themes.light,
      background: "0 0% 50%",
      card: "0 0% 55%",
      cardForeground: "0 0% 0%",
      secondary: "0 0% 10%",
      secondaryForeground: "0 0% 100%",
      accent: "0 0% 65%",
      accentForeground: "0 0% 0%",
    };
    const darkCustom: ThemeTokens = {
      ...themes.dark,
      background: "0 0% 50%",
      card: "0 0% 45%",
      cardForeground: "0 0% 100%",
      secondary: "0 0% 90%",
      secondaryForeground: "0 0% 0%",
      accent: "0 0% 35%",
      accentForeground: "0 0% 100%",
    };

    expect(announcementUnreadColors(lightCustom).surface).toBe("secondary");
    expect(announcementUnreadColors(darkCustom).surface).toBe("secondary");
  });

  it("falls back to the paired foreground when custom muted or primary colors are illegible", () => {
    const custom: ThemeTokens = {
      ...themes.light,
      background: "0 0% 98%",
      secondary: "0 0% 10%",
      secondaryForeground: "0 0% 100%",
      mutedForeground: "0 0% 20%",
      primary: "0 0% 12%",
    };

    const colors = announcementUnreadColors(custom);
    expect(colors.surface).toBe("secondary");
    expect(colors.foreground).toBe("rgb(255, 255, 255)");
    expect(colors.mutedForeground).toBe(colors.foreground);
    expect(colors.icon).toBe(colors.foreground);
  });
});

function contrastRatio(left: string, right: string) {
  const leftLuminance = luminance(left);
  const rightLuminance = luminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

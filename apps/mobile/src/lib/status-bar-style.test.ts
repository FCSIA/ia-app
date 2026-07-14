import { describe, expect, it } from "vitest";
import { hsl, themes } from "@ia/design-tokens";
import { statusBarStyleForBackground } from "./status-bar-style";

describe("statusBarStyleForBackground", () => {
  it("uses dark native icons on light app themes", () => {
    expect(statusBarStyleForBackground(hsl(themes.light.background))).toBe(
      "dark-content",
    );
    expect(statusBarStyleForBackground(hsl(themes.bubblegum.background))).toBe(
      "dark-content",
    );
  });

  it("uses light native icons on dark app themes", () => {
    expect(statusBarStyleForBackground(hsl(themes.dark.background))).toBe(
      "light-content",
    );
    expect(
      statusBarStyleForBackground(hsl(themes["high-contrast"].background)),
    ).toBe("light-content");
  });

  it("chooses the higher-contrast style for custom RGB colors", () => {
    expect(statusBarStyleForBackground("rgb(250, 250, 250)")).toBe(
      "dark-content",
    );
    expect(statusBarStyleForBackground("rgb(12, 15, 14)")).toBe(
      "light-content",
    );
    expect(statusBarStyleForBackground("rgb(249, 91, 1)")).toBe(
      "dark-content",
    );
  });
});

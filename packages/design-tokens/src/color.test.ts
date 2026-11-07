import { describe, expect, test } from "vitest";
import {
  blackOrWhiteOn,
  contrastRatio,
  hexToHslToken,
  hsl,
  hslTokenToRgb,
  isDarkTheme,
  normalizeHex,
  parseHex,
  rgbToHex,
} from "./color";

describe("hex parsing", () => {
  test("reads six digits with or without #, in any case", () => {
    expect(parseHex("#FF8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseHex("ff8000")).toEqual({ r: 255, g: 128, b: 0 });
  });

  test("accepts three-digit shorthand only when asked", () => {
    expect(parseHex("#f80")).toBeNull();
    expect(parseHex("#f80", { shorthand: true })).toEqual({ r: 255, g: 136, b: 0 });
  });

  test("rejects malformed values", () => {
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("#gggggg")).toBeNull();
    expect(normalizeHex("not a colour")).toBeNull();
  });

  test("normalizes to lowercase #rrggbb", () => {
    expect(normalizeHex(" ABCDEF ")).toBe("#abcdef");
    expect(rgbToHex({ r: 0, g: 10, b: 255 })).toBe("#000aff");
  });
});

describe("HSL tokens", () => {
  test("converts a hex colour to the token the palettes use", () => {
    expect(hexToHslToken("#ff0000")).toBe("0 100% 50%");
    expect(hexToHslToken("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslToken("#0f0", { shorthand: true })).toBe("120 100% 50%");
    expect(hexToHslToken("nope")).toBeNull();
  });

  test("round-trips back to the same channels", () => {
    for (const hex of ["#336699", "#ff8000", "#808080", "#0a0b0c"]) {
      const token = hexToHslToken(hex)!;
      const back = hslTokenToRgb(token);
      const original = parseHex(hex)!;
      expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.b - original.b)).toBeLessThanOrEqual(3);
    }
  });

  test("formats a token as an rgb() string", () => {
    expect(hsl("0 100% 50%")).toBe("rgb(255, 0, 0)");
  });
});

describe("contrast", () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };

  test("black on white is 21:1 and a colour on itself is 1:1", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
  });

  test("picks the more legible text colour", () => {
    expect(blackOrWhiteOn(white)).toBe("black");
    expect(blackOrWhiteOn(black)).toBe("white");
    expect(blackOrWhiteOn({ r: 255, g: 255, b: 0 })).toBe("black");
    expect(blackOrWhiteOn({ r: 0, g: 0, b: 128 })).toBe("white");
  });

  test("mid grey sits at the crossover and the choice has the higher contrast", () => {
    const grey = { r: 119, g: 119, b: 119 };
    const choice = blackOrWhiteOn(grey);
    const chosen = contrastRatio(grey, choice === "black" ? black : white);
    const other = contrastRatio(grey, choice === "black" ? white : black);
    expect(chosen).toBeGreaterThanOrEqual(other);
  });
});

describe("isDarkTheme", () => {
  test("knows the dark surfaces", () => {
    expect(isDarkTheme("dark")).toBe(true);
    expect(isDarkTheme("custom")).toBe(true);
    expect(isDarkTheme("light")).toBe(false);
    expect(isDarkTheme(null)).toBe(false);
  });
});

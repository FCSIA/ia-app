import { describe, expect, it } from "vitest";
import {
  scheduleLinesFromTsv,
  scheduleOcrImageDimensions,
} from "./schedule-ocr-local";

describe("scheduleLinesFromTsv", () => {
  it("combines OCR words into positioned schedule lines", () => {
    const tsv = [
      "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t30\t22\t10\t20\t96\t1",
      "5\t1\t1\t1\t1\t2\t220\t20\t30\t20\t96\tAP",
      "5\t1\t1\t1\t1\t3\t260\t20\t60\t20\t96\tComp",
      "5\t1\t1\t1\t2\t1\t220\t70\t40\t20\t95\t8:55",
    ].join("\n");

    expect(scheduleLinesFromTsv(tsv)).toEqual([
      { text: "1", left: 30, top: 22, right: 40, bottom: 42 },
      { text: "AP Comp", left: 220, top: 20, right: 320, bottom: 40 },
      { text: "8:55", left: 220, top: 70, right: 260, bottom: 90 },
    ]);
  });
});

describe("schedule OCR image sizes", () => {
  it.each([
    [480, 1200],
    [960, 680],
    [3840, 2160],
    [12000, 8000],
    [200, 10000],
  ])(
    "bounds memory for a %s x %s image without changing its shape",
    (width, height) => {
      const size = scheduleOcrImageDimensions(width, height);
      expect(size.width * size.height).toBeLessThanOrEqual(16_000_000);
      expect(size.width / size.height).toBeCloseTo(width / height, 2);
      expect(size.width).toBeLessThanOrEqual(width * 4);
      expect(size.height).toBeLessThanOrEqual(height * 4);
    },
  );
  it.each([
    [0, 100],
    [100, -1],
    [NaN, 100],
    [100, Infinity],
  ])("rejects invalid dimensions %s x %s", (width, height) => {
    expect(() => scheduleOcrImageDimensions(width, height)).toThrow(
      "invalid dimensions",
    );
  });
});

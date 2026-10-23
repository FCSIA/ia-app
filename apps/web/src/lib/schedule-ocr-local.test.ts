import { describe, expect, it } from "vitest";
import { scheduleLinesFromTsv } from "./schedule-ocr-local";

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
      { text: "1 AP Comp", left: 30, top: 20, right: 320, bottom: 42 },
      { text: "8:55", left: 220, top: 70, right: 260, bottom: 90 },
    ]);
  });
});

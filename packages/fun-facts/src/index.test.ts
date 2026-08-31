import { describe, expect, it } from "vitest";
import {
  NO_SCHOOL_MESSAGES,
  SCHOOL_OVER_MESSAGES,
  createNavigationLoadingFactPicker,
  pickDailySchoolMessage,
  pickNavigationLoadingMessage,
} from "./index";

function sequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe("navigation loading facts", () => {
  it("keeps the string picker compatible", () => {
    expect(pickNavigationLoadingMessage()).toEqual(expect.any(String));
  });

  it("selects rare facts with app-owned visual metadata", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0, 0]));
    expect(pick()).toMatchObject({ rarity: "rare", visual: "phoenix" });
  });

  it("selects non-Phoenix rare facts at the rare threshold", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.1, 0]));
    expect(pick()).toMatchObject({ rarity: "rare" });
    expect(pick().visual).toBeUndefined();
  });

  it("selects ordinary facts outside the rare and Phoenix thresholds", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.7, 0]));
    expect(pick()).toMatchObject({ rarity: "common" });
  });

  it("does not repeat common facts inside the 30-item history window", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.7, 0]));
    const ids = Array.from({ length: 30 }, () => pick().id);
    expect(new Set(ids)).toHaveLength(ids.length);
  });
});

describe("school day messages", () => {
  it("picks a stable message from the matching context", () => {
    const seed = "student-1:2026-08-29";

    expect(NO_SCHOOL_MESSAGES).toContain(pickDailySchoolMessage("no-school", seed));
    expect(SCHOOL_OVER_MESSAGES).toContain(pickDailySchoolMessage("school-over", seed));
    expect(pickDailySchoolMessage("school-over", seed)).toBe(
      pickDailySchoolMessage("school-over", seed),
    );
  });
});

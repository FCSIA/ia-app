import { describe, expect, it } from "vitest";
import {
  NAVIGATION_LOADING_MESSAGES,
  NO_SCHOOL_MESSAGES,
  PHOENIX_LOADING_FACTS,
  SPOTLIGHT_LOADING_FACTS,
  SCHOOL_OVER_MESSAGES,
  createNavigationLoadingFactPicker,
  pickDailySchoolMessage,
  pickNavigationLoadingMessage,
} from "./index";

function sequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

describe("navigation loading facts", () => {
  it("keeps the string picker compatible", () => {
    expect(pickNavigationLoadingMessage()).toEqual(expect.any(String));
  });

  it("selects Phoenix facts with app-owned visual metadata", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0, 0]));
    expect(pick()).toMatchObject({ category: "phoenix", visual: "phoenix" });
    expect(PHOENIX_LOADING_FACTS.length).toBeGreaterThanOrEqual(5);
  });

  it("includes IA campus and app lore without advertising unbuilt rewards", () => {
    expect(
      NAVIGATION_LOADING_MESSAGES.some((msg) => msg.includes("eXchange")),
    ).toBe(true);
    expect(
      NAVIGATION_LOADING_MESSAGES.some((msg) => msg.includes("Share Feedback")),
    ).toBe(true);
    expect(NAVIGATION_LOADING_MESSAGES.join(" ")).not.toMatch(/Hall of Finders|hidden keys/);
    expect(PHOENIX_LOADING_FACTS.map((fact) => fact.text).join(" ")).not.toMatch(
      /Hall of Finders|hidden keys/,
    );
    NAVIGATION_LOADING_MESSAGES.forEach((msg) => {
      expect(/[.!?"”)*]$/.test(msg)).toBe(true);
    });
  });

  it("selects spotlight facts separately from Phoenix facts", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.05, 0]));
    expect(pick()).toMatchObject({ category: "spotlight" });
    expect(pick().visual).toBeUndefined();
  });

  it("selects standard facts outside the spotlight and Phoenix thresholds", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.5, 0]));
    expect(pick()).toMatchObject({ category: "standard" });
  });

  it("keeps a sufficiently varied spotlight pool", () => {
    expect(SPOTLIGHT_LOADING_FACTS).toHaveLength(12);
    SPOTLIGHT_LOADING_FACTS.forEach((fact) => {
      expect(NAVIGATION_LOADING_MESSAGES).not.toContain(fact.text);
    });
  });

  it("does not repeat facts inside the 30-item history window", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.7, 0]));
    const ids = Array.from({ length: 30 }, () => pick().id);
    expect(new Set(ids)).toHaveLength(ids.length);
  });

  it("falls back to an unseen fact when the spotlight pool is exhausted", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.05, 0]));
    const ids = Array.from({ length: 13 }, () => pick().id);

    expect(new Set(ids)).toHaveLength(ids.length);
  });

  it.each([
    [20, 7],
    [35, 42],
    [50, 1_337],
  ])("keeps the previous 30 facts fresh across a %i-pick sample", (sampleSize, seed) => {
    const pick = createNavigationLoadingFactPicker(seededRandom(seed));
    const facts = Array.from({ length: sampleSize }, () => pick());

    facts.forEach((fact, index) => {
      const previousIds = facts
        .slice(Math.max(0, index - 30), index)
        .map((previousFact) => previousFact.id);
      expect(previousIds).not.toContain(fact.id);
    });
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

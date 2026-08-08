import { describe, expect, it } from "vitest";
import {
  createNavigationLoadingFactPicker,
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

  it("selects ordinary facts outside the rare threshold", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.5, 0]));
    expect(pick()).toMatchObject({ rarity: "common" });
  });

  it("does not repeat common facts inside the 30-item history window", () => {
    const pick = createNavigationLoadingFactPicker(sequenceRandom([0.5, 0]));
    const ids = Array.from({ length: 30 }, () => pick().id);
    expect(new Set(ids)).toHaveLength(ids.length);
  });
});

import { describe, expect, test } from "vitest";
import {
  MAX_CLUB_UNIT_DEPTH,
  assertDistinctSiblingName,
  assertHierarchyDepth,
  assignmentCoversUnit,
  childUnitIdsByParent,
  normalizeOptionalLabel,
  normalizeRequiredLabel,
  unitAndDescendantIds,
} from "./hierarchyRules";

describe("club hierarchy rules", () => {
  test("normalizes human-authored labels", () => {
    expect(normalizeRequiredLabel("  FRC   8866 ", "Name", 80)).toBe("FRC 8866");
    expect(normalizeOptionalLabel("  Intake   subsystem ", 80)).toBe(
      "Intake subsystem",
    );
    expect(normalizeOptionalLabel("   ", 80)).toBeUndefined();
  });

  test("prevents ambiguous sibling names", () => {
    expect(() => assertDistinctSiblingName(["FRC", "FTC"], " frc ")).toThrow(
      "already exists",
    );
    expect(() => assertDistinctSiblingName(["FRC"], "FTC")).not.toThrow();
  });

  test("bounds pathological nesting without prescribing level types", () => {
    expect(() => assertHierarchyDepth(MAX_CLUB_UNIT_DEPTH)).not.toThrow();
    expect(() => assertHierarchyDepth(MAX_CLUB_UNIT_DEPTH + 1)).toThrow(
      "nested levels",
    );
  });

  test("collects a unit and everything beneath it, parents before children", () => {
    const children = childUnitIdsByParent([
      { _id: "root" },
      { _id: "a", parentUnitId: "root" },
      { _id: "b", parentUnitId: "root" },
      { _id: "a1", parentUnitId: "a" },
      { _id: "elsewhere" },
    ]);
    expect(unitAndDescendantIds("root", children)).toEqual(["root", "a", "b", "a1"]);
    expect(unitAndDescendantIds("a", children)).toEqual(["a", "a1"]);
    expect(unitAndDescendantIds("elsewhere", children)).toEqual(["elsewhere"]);
  });

  test("stops at corrupt parent cycles instead of looping", () => {
    const children = childUnitIdsByParent([
      { _id: "a", parentUnitId: "b" },
      { _id: "b", parentUnitId: "a" },
    ]);
    expect(unitAndDescendantIds("a", children)).toEqual(["a", "b"]);
    const parents = new Map<string, string | null>([["a", "b"], ["b", "a"]]);
    expect(assignmentCoversUnit("c", "a", parents)).toBe(false);
  });

  test("an assignment covers its own unit and every unit below it", () => {
    const parents = new Map<string, string | null>([["root", null], ["a", "root"], ["a1", "a"]]);
    expect(assignmentCoversUnit("a", "a1", parents)).toBe(true);
    expect(assignmentCoversUnit("a", "a", parents)).toBe(true);
    expect(assignmentCoversUnit("a1", "a", parents)).toBe(false);
  });
});

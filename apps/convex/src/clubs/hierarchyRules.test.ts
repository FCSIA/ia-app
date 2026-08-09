import { describe, expect, test } from "vitest";
import {
  MAX_CLUB_UNIT_DEPTH,
  assertDistinctSiblingName,
  assertHierarchyDepth,
  normalizeOptionalLabel,
  normalizeRequiredLabel,
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
});

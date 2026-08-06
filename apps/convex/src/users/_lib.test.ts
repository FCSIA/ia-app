import { describe, expect, test } from "vitest";
import { generateTemporaryPassword } from "./_lib";

describe("generateTemporaryPassword", () => {
  test("defaults to Better Auth's 12-character minimum", () => {
    expect(generateTemporaryPassword()).toHaveLength(12);
  });
});

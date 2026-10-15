import { describe, expect, test, vi } from "vitest";
import { listCourseCandidates } from "./_lib";

describe("course candidate reads", () => {
  test("bounds an unfiltered list at the requested limit in storage", async () => {
    const take = vi.fn(async () => []);
    const withIndex = vi.fn(() => ({ take }));
    const query = vi.fn(() => ({ withIndex }));

    await listCourseCandidates(
      { db: { query } } as never,
      { limit: 40 },
    );

    expect(withIndex).toHaveBeenCalledWith("by_department_and_title");
    expect(take).toHaveBeenCalledWith(40);
  });

  test("retains the bounded fallback when grade filtering happens in memory", async () => {
    const take = vi.fn(async () => []);
    const withIndex = vi.fn(() => ({ take }));
    const query = vi.fn(() => ({ withIndex }));

    await listCourseCandidates(
      { db: { query } } as never,
      { gradeLevel: 10, limit: 40 },
    );

    expect(take).toHaveBeenCalledWith(500);
  });
});

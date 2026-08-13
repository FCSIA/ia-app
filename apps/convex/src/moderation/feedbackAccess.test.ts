import { describe, expect, it } from "vitest";
import { canReviewFeedback } from "./feedbackAccess";

describe("feedback reviewer access", () => {
  it("allows the dedicated capability without granting other admin roles", () => {
    expect(canReviewFeedback({ roles: ["STUDENT"], canReviewFeedback: true })).toBe(true);
    expect(canReviewFeedback({ roles: ["STUDENT"] })).toBe(false);
  });

  it("keeps super-admin feedback access", () => {
    expect(canReviewFeedback({ roles: ["SUPER_ADMIN"] })).toBe(true);
  });
});

import { describe, expect, test } from "vitest";
import {
  MAX_SHARED_MESSAGE_PAGE_SIZE,
  boundedSharedMessagePageSize,
} from "./sharedPagination";

describe("club shared-content pagination", () => {
  test("keeps message scans bounded", () => {
    expect(boundedSharedMessagePageSize(0)).toBe(1);
    expect(boundedSharedMessagePageSize(24.9)).toBe(24);
    expect(boundedSharedMessagePageSize(Number.POSITIVE_INFINITY)).toBe(30);
    expect(boundedSharedMessagePageSize(500)).toBe(MAX_SHARED_MESSAGE_PAGE_SIZE);
  });
});

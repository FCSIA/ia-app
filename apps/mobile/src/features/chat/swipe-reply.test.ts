import { describe, expect, test } from "vitest";
import {
  resistedReplySwipeDistance,
  shouldTriggerSwipeReply,
  SWIPE_REPLY_THRESHOLD,
} from "./swipe-reply";

describe("swipe to reply", () => {
  test("requires a deliberate distance or leftward flick", () => {
    expect(shouldTriggerSwipeReply(-71, -200, false)).toBe(false);
    expect(shouldTriggerSwipeReply(-72, -200, true)).toBe(true);
    expect(shouldTriggerSwipeReply(-30, -900, false)).toBe(true);
    expect(shouldTriggerSwipeReply(-20, -1_100, false)).toBe(false);
    expect(shouldTriggerSwipeReply(40, -1_100, false)).toBe(false);
  });

  test("adds resistance after crossing the reply threshold", () => {
    expect(resistedReplySwipeDistance(-20)).toBe(0);
    expect(resistedReplySwipeDistance(SWIPE_REPLY_THRESHOLD)).toBe(72);
    expect(resistedReplySwipeDistance(92)).toBe(76);
  });
});

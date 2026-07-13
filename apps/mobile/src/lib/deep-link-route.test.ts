import { describe, expect, it } from "vitest";
import { normalizeHref, resolveAppHref } from "./deep-link-route";

describe("mobile notification routes", () => {
  it("opens schedule friend requests in the Calendar tab", () => {
    expect(resolveAppHref("/schedule?tab=friends")).toBe("/calendar");
  });

  it("maps web-only destinations to their native equivalents", () => {
    expect(resolveAppHref("/admin?tab=moderation")).toBe("/admin/moderation");
    expect(resolveAppHref("/clubs/club-1/people")).toBe("/clubs/club-1/people");
  });

  it("preserves supported detail routes", () => {
    expect(resolveAppHref("https://app.example.org/announcements/announcement-1"))
      .toBe("/announcements/announcement-1");
    expect(resolveAppHref("/clubs/club-1/channels/general?thread=message-1"))
      .toBe("/clubs/club-1/channels/general");
  });

  it("normalizes relative paths and safely falls back", () => {
    expect(normalizeHref("events/event-1")).toBe("/events/event-1");
    expect(resolveAppHref("/web-only-page")).toBe("/dashboard");
  });
});

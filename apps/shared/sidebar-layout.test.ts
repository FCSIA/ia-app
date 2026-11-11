import { describe, expect, it } from "vitest";
import { normalizeSidebarLayout } from "./sidebar-layout";

describe("sidebar layout", () => {
  it("preserves the chosen order while excluding unavailable and duplicate routes", () => {
    expect(normalizeSidebarLayout(["/admin", "/events", "/events", "/clubs"], ["/clubs", "/events"]))
      .toEqual(["/events", "/clubs"]);
  });
  it("distinguishes defaults from an intentionally empty primary list", () => {
    expect(normalizeSidebarLayout(undefined, ["/clubs", "/events"])).toEqual(["/clubs", "/events"]);
    expect(normalizeSidebarLayout([], ["/clubs", "/events"])).toEqual([]);
  });
  it("does not promote newly available destinations into a saved layout", () => {
    expect(normalizeSidebarLayout(["/events"], ["/events", "/wrapped"])).toEqual(["/events"]);
  });
});

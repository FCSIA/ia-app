import { describe, expect, it } from "vitest";
import { validateIcsFeedUrl } from "./externalCalendars";

describe("external calendar feed URLs", () => {
  it("accepts HTTPS feeds and removes fragments", () => {
    expect(validateIcsFeedUrl("https://fultonschools.instructure.com/feed.ics#private")).toBe(
      "https://fultonschools.instructure.com/feed.ics",
    );
  });

  it("rejects non-HTTPS and private hosts", () => {
    expect(() => validateIcsFeedUrl("http://calendar.example/feed.ics")).toThrow();
    expect(() => validateIcsFeedUrl("https://127.0.0.1/feed.ics")).toThrow();
    expect(() => validateIcsFeedUrl("https://192.168.1.10/feed.ics")).toThrow();
    expect(() => validateIcsFeedUrl("https://169.254.169.254/feed.ics")).toThrow();
    expect(() => validateIcsFeedUrl("https://calendar.example:8443/feed.ics")).toThrow();
  });
});

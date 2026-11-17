import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Timeline } from "../../ui/timeline";
import { volunteerTimeline } from "./volunteer-timeline";

const base = { serviceDate: "2026-11-01", submittedAt: new Date(2026, 10, 1, 12).getTime(), status: "PENDING" };
describe("volunteer timeline", () => {
  test("date-only service sorts at local start of day and pending has no timestamp", () => {
    const events = volunteerTimeline(base);
    expect(events.map(e => e.id)).toEqual(["service", "submitted", "pending"]);
    expect(events[0].timestamp?.dateTime).toBe("2026-11-01");
    expect(events[2].timestamp).toBeUndefined();
  });
  test("missing decision dates remain undated", () => {
    const events = volunteerTimeline({ ...base, status: "DECLINED" });
    expect(events[2].timestamp).toBeUndefined();
    expect(events[2].description).toContain("Decision date unavailable");
    expect(events).toHaveLength(3);
  });
  test("actual decision timestamps determine ordering, including zero", () => {
    const events = volunteerTimeline({ ...base, status: "APPROVED", reviewedAt: 0 });
    expect(events[0].id).toBe("decision");
    expect(events[0].timestamp?.dateTime).toBe("1970-01-01T00:00:00.000Z");
  });
  test("SSR exposes list, real times, current status and descriptions", () => {
    const html = renderToStaticMarkup(<Timeline label="Submission history" events={volunteerTimeline(base)} />);
    expect(html).toContain('<ol aria-label="Submission history"');
    expect(html.match(/<time /g)).toHaveLength(2);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Awaiting a review decision.");
    expect(renderToStaticMarkup(<Timeline label="Empty" events={[]} />)).toContain("No events yet.");
  });
});

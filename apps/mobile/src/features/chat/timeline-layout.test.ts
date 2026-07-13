import { describe, expect, it } from "vitest";
import {
  buildTimelineRows,
  formatDateLabel,
  shouldGroupMessages,
} from "./timeline-layout";
import type { ChatMessage } from "./types";

function message(
  id: string,
  authorId: string,
  createdAt: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    _id: id,
    authorId,
    body: id,
    replyCount: 0,
    isPinned: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("mobile chat timeline layout", () => {
  it("groups consecutive messages from one author within five minutes", () => {
    const first = message("one", "alex", "2026-07-13T13:00:00.000Z");
    const second = message("two", "alex", "2026-07-13T13:04:59.000Z");

    expect(shouldGroupMessages(first, second)).toBe(true);
    expect(
      shouldGroupMessages(
        first,
        message("three", "alex", "2026-07-13T13:05:01.000Z"),
      ),
    ).toBe(false);
  });

  it("keeps author, day, and pinned boundaries visually explicit", () => {
    const first = message("one", "alex", "2026-07-14T03:59:00.000Z");

    expect(
      shouldGroupMessages(
        first,
        message("two", "sam", "2026-07-14T03:59:30.000Z"),
      ),
    ).toBe(false);
    expect(
      shouldGroupMessages(
        first,
        message("three", "alex", "2026-07-14T04:01:00.000Z"),
      ),
    ).toBe(false);
    expect(
      shouldGroupMessages(
        first,
        message("four", "alex", "2026-07-14T03:59:30.000Z", {
          isPinned: true,
        }),
      ),
    ).toBe(false);
  });

  it("sorts rows, inserts date markers, and resets grouping after a marker", () => {
    const rows = buildTimelineRows(
      [
        message("new", "alex", "2026-07-13T13:02:00.000Z"),
        message("old", "alex", "2026-07-13T13:00:00.000Z"),
      ],
      null,
      new Date("2026-07-13T18:00:00.000Z"),
    );

    expect(rows.map((row) => row.key)).toEqual([
      "date:2026-07-13",
      "message:old",
      "message:new",
    ]);
    expect(rows[1]).toMatchObject({ groupedWithPrevious: false });
    expect(rows[2]).toMatchObject({ groupedWithPrevious: true });
  });

  it("uses concise relative labels only for today and yesterday", () => {
    const now = new Date("2026-07-13T18:00:00.000Z");
    expect(formatDateLabel(new Date("2026-07-13T09:00:00.000Z"), now)).toBe(
      "Today",
    );
    expect(formatDateLabel(new Date("2026-07-12T09:00:00.000Z"), now)).toBe(
      "Yesterday",
    );
    expect(formatDateLabel(new Date("2026-06-10T09:00:00.000Z"), now)).toBe(
      "Wednesday, Jun 10",
    );
  });
});

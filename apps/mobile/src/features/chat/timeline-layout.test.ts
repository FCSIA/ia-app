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

function localTimestamp(day: number, hour: number, minute: number) {
  return new Date(2026, 6, day, hour, minute).toISOString();
}

describe("mobile chat timeline layout", () => {
  it("groups consecutive messages from one author within five minutes", () => {
    const first = message("one", "alex", localTimestamp(13, 13, 0));
    const second = message("two", "alex", localTimestamp(13, 13, 4));

    expect(shouldGroupMessages(first, second)).toBe(true);
    expect(
      shouldGroupMessages(
        first,
        message("three", "alex", localTimestamp(13, 13, 6)),
      ),
    ).toBe(false);
    expect(
      shouldGroupMessages(
        first,
        message("five", "alex", localTimestamp(13, 13, 1), {
          deliveryState: "sending",
        }),
      ),
    ).toBe(false);
  });

  it("keeps author, day, and pinned boundaries visually explicit", () => {
    const first = message("one", "alex", localTimestamp(13, 23, 59));

    expect(
      shouldGroupMessages(
        first,
        message("two", "sam", localTimestamp(13, 23, 59)),
      ),
    ).toBe(false);
    expect(
      shouldGroupMessages(
        first,
        message("three", "alex", localTimestamp(14, 0, 1)),
      ),
    ).toBe(false);
    expect(
      shouldGroupMessages(
        first,
        message("four", "alex", localTimestamp(13, 23, 59), {
          isPinned: true,
        }),
      ),
    ).toBe(false);
  });

  it("sorts rows, inserts date markers, and resets grouping after a marker", () => {
    const rows = buildTimelineRows(
      [
        message("new", "alex", localTimestamp(13, 13, 2)),
        message("old", "alex", localTimestamp(13, 13, 0)),
      ],
      null,
      new Date(2026, 6, 13, 18),
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
    const now = new Date(2026, 6, 13, 18);
    expect(formatDateLabel(new Date(2026, 6, 13, 9), now)).toBe(
      "Today",
    );
    expect(formatDateLabel(new Date(2026, 6, 12, 9), now)).toBe(
      "Yesterday",
    );
    expect(formatDateLabel(new Date(2026, 5, 10, 9), now)).toBe(
      "Wednesday, Jun 10",
    );
  });
});

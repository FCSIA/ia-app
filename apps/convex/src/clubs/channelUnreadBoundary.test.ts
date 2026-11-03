import { describe, expect, test } from "vitest";
import {
  captureChannelUnreadBoundary,
  firstUnreadChannelMessageId,
} from "../../../shared/chat/unread-boundary";

const messages = [
  { _id: "read", createdAt: 10 },
  { _id: "first-unread", createdAt: 20 },
  { _id: "newest", createdAt: 30 },
];

describe("channel unread boundary", () => {
  test("waits for both receipt and first message page", () => {
    expect(captureChannelUnreadBoundary(undefined, "a", undefined, messages)).toBeUndefined();
    expect(captureChannelUnreadBoundary(undefined, "a", 10, undefined)).toBeUndefined();
  });
  test("places the divider after the last read message and keeps it after acknowledgement", () => {
    const entry = captureChannelUnreadBoundary(undefined, "a", 10, messages);
    expect(firstUnreadChannelMessageId(messages, entry)).toBe("first-unread");
    const acknowledged = captureChannelUnreadBoundary(entry, "a", 30, messages);
    expect(acknowledged).toBe(entry);
    expect(firstUnreadChannelMessageId(messages, acknowledged)).toBe("first-unread");
  });
  test("captures a new boundary on channel or account change and revisits", () => {
    const entry = captureChannelUnreadBoundary(undefined, "a:user", 10, messages);
    const other = captureChannelUnreadBoundary(entry, "b:user", 30, messages);
    expect(firstUnreadChannelMessageId(messages, other)).toBeNull();
    const revisit = captureChannelUnreadBoundary(other, "a:user", 30, messages);
    expect(firstUnreadChannelMessageId(messages, revisit)).toBeNull();
    const otherUser = captureChannelUnreadBoundary(entry, "a:other", 0, messages);
    expect(firstUnreadChannelMessageId(messages, otherUser)).toBe("read");
  });
  test("does not create a divider for new arrivals in an already-read or empty visit", () => {
    const entry = captureChannelUnreadBoundary(undefined, "a", 30, messages);
    expect(firstUnreadChannelMessageId([...messages, { _id: "live", createdAt: 40 }], entry)).toBeNull();
    const empty = captureChannelUnreadBoundary(undefined, "b", 0, []);
    expect(firstUnreadChannelMessageId([{ _id: "live", createdAt: 40 }], empty)).toBeNull();
  });
  test("handles no receipt, deleted posts, ISO timestamps and older pagination", () => {
    const entry = captureChannelUnreadBoundary(undefined, "a", 0, messages.slice(1));
    expect(firstUnreadChannelMessageId(messages.slice(1), entry)).toBe("first-unread");
    expect(firstUnreadChannelMessageId(messages, entry)).toBe("read");
    expect(firstUnreadChannelMessageId([{ ...messages[0], isDeleted: true }, ...messages.slice(1)], entry)).toBe("first-unread");
    const iso = [{ _id: "iso", createdAt: new Date(20).toISOString() }];
    expect(firstUnreadChannelMessageId(iso, captureChannelUnreadBoundary(undefined, "b", 10, iso))).toBe("iso");
  });
  test("never labels the viewer's own or pending messages as unread", () => {
    const rows = [{ _id: "own", authorId: "viewer", createdAt: 20 }, { _id: "optimistic:pending", authorId: "other", createdAt: 25 }, { _id: "other", author: { _id: "other" }, createdAt: 30 }];
    const boundary = captureChannelUnreadBoundary(undefined, "channel:viewer", 10, rows);
    expect(firstUnreadChannelMessageId(rows, boundary, "viewer")).toBe("other");
    expect(firstUnreadChannelMessageId(rows.slice(0, 2), boundary, "viewer")).toBeNull();
  });
});
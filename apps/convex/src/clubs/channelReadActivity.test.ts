import { describe, expect, test } from "vitest";
import { latestVisibleChatActivity } from "../../../shared/chat/activity";
import { createOptimisticMessageShape } from "../../../shared/chat/optimistic-message-shape";

const pending = createOptimisticMessageShape(
  { channelId: "channel", body: "Sending", clientGeneratedId: "pending", clientSentAt: 30 },
  { _id: "user", uniqueId: "TEST", firstName: "Test", lastName: "User", roles: ["STUDENT"] },
)!;

describe("persisted chat read activity", () => {
  test("does not acknowledge an optimistic-only channel", () => {
    expect(latestVisibleChatActivity([pending])).toBeNull();
  });
  test("retains the latest confirmed boundary while a newer post is pending", () => {
    expect(latestVisibleChatActivity([
      { _id: "confirmed", createdAt: 20 },
      pending,
    ])).toEqual({ messageId: "confirmed", occurredAt: 20 });
  });
  test("skips optimistic reply previews and nested replies", () => {
    expect(latestVisibleChatActivity([{
      _id: "root", createdAt: 10,
      latestReplyPreview: { _id: pending._id, createdAt: pending.createdAt },
      replies: [{ _id: "confirmed-reply", createdAt: 20 }, pending],
    }])).toEqual({ messageId: "confirmed-reply", occurredAt: 20 });
  });
  test("acknowledges the persisted replacement even when its timestamp is unchanged", () => {
    expect(latestVisibleChatActivity([pending])).toBeNull();
    expect(latestVisibleChatActivity([{ ...pending, _id: "persisted" }]))
      .toEqual({ messageId: "persisted", occurredAt: 30 });
  });
  test("keeps confirmed reply previews, ISO timestamps and empty lists working", () => {
    expect(latestVisibleChatActivity([{
      _id: "root", createdAt: 10,
      latestReplyPreview: { _id: "preview", createdAt: new Date(40).toISOString() },
    }])).toEqual({ messageId: "preview", occurredAt: 40 });
    expect(latestVisibleChatActivity([])).toBeNull();
    expect(latestVisibleChatActivity(undefined)).toBeNull();
  });
});
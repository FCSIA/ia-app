import { describe, expect, test } from "vitest";
import { latestVisibleChatActivity } from "../../../shared/chat/activity";

describe("saved chat read boundaries", () => {
  test("ignores temporary sends and selects the latest saved activity", () => {
    expect(latestVisibleChatActivity([
      { _id: "saved", createdAt: 100 },
      { _id: "optimistic:send", createdAt: 300 },
    ])).toEqual({ messageId: "saved", occurredAt: 100 });
    expect(latestVisibleChatActivity([
      { _id: "optimistic:send", createdAt: 300 },
    ])).toBeNull();
  });

  test("ignores optimistic reply previews and nested replies", () => {
    expect(latestVisibleChatActivity([{
      _id: "parent", createdAt: 100,
      latestReplyPreview: { _id: "optimistic:preview", createdAt: 400 },
      replies: [
        { _id: "reply", createdAt: 200 },
        { _id: "optimistic:reply", createdAt: 500 },
      ],
    }])).toEqual({ messageId: "reply", occurredAt: 200 });
  });

  test("advances when a temporary send receives its saved ID", () => {
    expect(latestVisibleChatActivity([
      { _id: "parent", createdAt: 100 },
      { _id: "saved-send", createdAt: 300 },
    ])).toEqual({ messageId: "saved-send", occurredAt: 300 });
  });
});

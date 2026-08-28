import { describe, expect, test } from "vitest";
import {
  channelNotificationAuthorName,
  channelNotificationTitle,
} from "./channelNotificationCopy";

describe("club channel notification copy", () => {
  test("includes the sender in each message notification kind", () => {
    expect(
      channelNotificationTitle({
        authorName: "Matthew Kingsly",
        channelName: "robotics",
        kind: "MESSAGE",
      }),
    ).toBe("Matthew Kingsly in #robotics");
    expect(
      channelNotificationTitle({
        authorName: "Matthew Kingsly",
        channelName: "robotics",
        kind: "THREAD_REPLY",
      }),
    ).toBe("Matthew Kingsly replied in #robotics");
    expect(
      channelNotificationTitle({
        authorName: "Matthew Kingsly",
        channelName: "robotics",
        kind: "USER_MENTION",
      }),
    ).toBe("Matthew Kingsly mentioned you in #robotics");
    expect(
      channelNotificationTitle({
        authorName: "Matthew Kingsly",
        channelName: "robotics",
        kind: "GROUP_MENTION",
      }),
    ).toBe("Matthew Kingsly mentioned your group in #robotics");
  });

  test("formats partial names and keeps a safe fallback", () => {
    expect(channelNotificationAuthorName({ firstName: "Matthew" })).toBe("Matthew");
    expect(
      channelNotificationTitle({
        authorName: "",
        channelName: "general",
        kind: "MESSAGE",
      }),
    ).toBe("Club member in #general");
  });
});

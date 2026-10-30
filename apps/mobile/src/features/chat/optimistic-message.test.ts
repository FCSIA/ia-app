import { describe, expect, test } from "vitest";
import {
  createClientMessageIdentity,
  createOptimisticMessageShape,
  type OptimisticMessageShapeAuthor,
} from "../../../../shared/chat/optimistic-message-shape";

const author = {
  _id: "user-1",
  uniqueId: "STU001",
  firstName: "Alex",
  lastName: "Johnson",
  email: "alex@example.edu",
  roles: ["STUDENT"],
  avatarUrl: undefined,
} satisfies OptimisticMessageShapeAuthor;

describe("chat replay identity", () => {
  test("requires replay-stable identity metadata", () => {
    expect(
      createOptimisticMessageShape(
        {
          channelId: "channel-1",
          body: "Hello",
        },
        author,
      ),
    ).toBeNull();

    const first = createClientMessageIdentity(100);
    const second = createClientMessageIdentity(100);
    expect(first.clientSentAt).toBe(100);
    expect(second.clientSentAt).toBe(100);
    expect(first.clientGeneratedId).not.toBe(second.clientGeneratedId);
  });
});

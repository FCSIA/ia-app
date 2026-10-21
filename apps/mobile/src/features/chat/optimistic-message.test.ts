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

describe("mobile optimistic chat messages", () => {
  test("keeps the preferred author name while a message is sending", () => {
    const message = createOptimisticMessageShape(
      { channelId: "channel-1", body: "Hello", clientGeneratedId: "name-1", clientSentAt: 100 },
      { ...author, preferredName: "Lex" },
    );
    expect(message?.author).toMatchObject({ firstName: "Alex", lastName: "Johnson", preferredName: "Lex" });
  });

  test("creates a stable local row from client mutation metadata", () => {
    const message = createOptimisticMessageShape(
      {
        channelId: "channel-1",
        body: "  Ready for kickoff  ",
        bodyMarkdown: "**Ready** for kickoff",
        clientGeneratedId: "local-1",
        clientSentAt: 1_720_000_000_000,
      },
      author,
    );

    expect(message).toMatchObject({
      _id: "optimistic:local-1",
      authorId: "user-1",
      body: "Ready for kickoff",
      bodyMarkdown: "**Ready** for kickoff",
      createdAt: "2024-07-03T09:46:40.000Z",
      clientGeneratedId: "local-1",
      deliveryState: "sending",
    });
  });

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

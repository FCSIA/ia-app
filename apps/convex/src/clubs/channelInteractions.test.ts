/// <reference types="vite/client" />

import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const aliceId = await insertUser(ctx, { uniqueId: "ALICE" });
    const bobId = await insertUser(ctx, { uniqueId: "BOB" });
    const clubId = await ctx.db.insert("clubs", {
      name: "Interaction Club",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    for (const userId of [aliceId, bobId]) {
      await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    }
    const channelId = await ctx.db.insert("clubChannels", {
      clubId,
      name: "General",
      visibility: "PUBLIC",
      createdById: aliceId,
      createdAt: 1,
      updatedAt: 1,
    });
    const messageId = await ctx.db.insert("clubChannelMessages", {
      channelId,
      authorId: aliceId,
      body: "Lunch?",
      pollQuestion: "Where?",
      pollOptions: [
        { id: "a", label: "Cafeteria" },
        { id: "b", label: "Courtyard" },
      ],
      isPinned: false,
      createdAt: 1,
      updatedAt: 1,
    });
    return { aliceId, bobId, clubId, channelId, messageId };
  });
  return {
    t,
    ...ids,
    alice: t.withIdentity({ subject: ids.aliceId }),
    bob: t.withIdentity({ subject: ids.bobId }),
  };
}

describe("reactions", () => {
  test("a token toggle removes a reaction stored as its legacy glyph", async () => {
    const { t, alice, aliceId, messageId } = await fixture();
    await t.run((ctx) =>
      ctx.db.insert("clubChannelMessageReactions", {
        messageId,
        userId: aliceId,
        emoji: "🎉",
        createdAt: 1,
      }),
    );

    await alice.mutation(api.clubs.channels.toggleReaction, { messageId, emoji: "CELEBRATE" });

    expect(await t.run((ctx) => ctx.db.query("clubChannelMessageReactions").collect())).toEqual([]);
  });
});

describe("polls", () => {
  test("voting picks, switches and clears an option, and counts per option", async () => {
    const f = await fixture();
    const poll = async (who: typeof f.alice) =>
      (
        await who.query(api.clubs.channels.getMessage, {
          clubId: f.clubId,
          channelId: f.channelId,
          messageId: f.messageId,
        })
      )?.poll;

    await f.alice.mutation(api.clubs.channels.votePoll, { messageId: f.messageId, optionId: "a" });
    await f.bob.mutation(api.clubs.channels.votePoll, { messageId: f.messageId, optionId: "a" });
    expect(await poll(f.alice)).toMatchObject({
      totalVotes: 2,
      votesTruncated: false,
      options: [
        { id: "a", count: 2, votedByCurrentUser: true },
        { id: "b", count: 0, votedByCurrentUser: false },
      ],
    });

    await f.alice.mutation(api.clubs.channels.votePoll, { messageId: f.messageId, optionId: "b" });
    expect(await poll(f.alice)).toMatchObject({
      options: [
        { id: "a", count: 1, votedByCurrentUser: false },
        { id: "b", count: 1, votedByCurrentUser: true },
      ],
    });

    await f.alice.mutation(api.clubs.channels.votePoll, { messageId: f.messageId, optionId: "b" });
    expect(await poll(f.alice)).toMatchObject({ totalVotes: 1 });
  });

  test("rejects an option the poll does not have", async () => {
    const { alice, messageId } = await fixture();
    await expect(
      alice.mutation(api.clubs.channels.votePoll, { messageId, optionId: "zzz" }),
    ).rejects.toThrow("Poll option not found");
  });

  test("a poll with more votes than the summary cap reports the capped slice", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("clubChannelMessagePollVotes", {
          messageId: f.messageId,
          userId: f.bobId,
          optionId: "a",
          createdAt: 1,
        });
      }
    });

    const message = await f.alice.query(api.clubs.channels.getMessage, {
      clubId: f.clubId,
      channelId: f.channelId,
      messageId: f.messageId,
    });

    expect(message?.poll).toMatchObject({ totalVotes: 500, votesTruncated: true });
  });
});

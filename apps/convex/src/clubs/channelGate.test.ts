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
    const memberId = await insertUser(ctx, { uniqueId: "GATE-MEMBER" });
    const outsiderId = await insertUser(ctx, { uniqueId: "GATE-OUTSIDER" });
    const makeClub = (name: string, isActive = true) =>
      ctx.db.insert("clubs", { name, joinPolicy: "OPEN", isActive, createdAt: 1, updatedAt: 1 });
    const clubId = await makeClub("Gate Club");
    const otherClubId = await makeClub("Other Club");
    const inactiveClubId = await makeClub("Closed Club", false);
    for (const id of [clubId, inactiveClubId]) {
      await ctx.db.insert("clubMembers", { clubId: id, userId: memberId, role: "MEMBER", joinedAt: 1 });
    }
    const makeChannel = (club: typeof clubId) =>
      ctx.db.insert("clubChannels", {
        clubId: club,
        name: "General",
        visibility: "PUBLIC",
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      });
    const channelId = await makeChannel(clubId);
    const inactiveChannelId = await makeChannel(inactiveClubId);
    const orphanChannelId = await makeChannel(otherClubId);
    await ctx.db.delete(otherClubId);
    const addMessage = async (channel: typeof channelId) => {
      const messageId = await ctx.db.insert("clubChannelMessages", {
        channelId: channel,
        authorId: memberId,
        body: "hello",
        isPinned: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("clubChannelMessageAttachments", {
        messageId,
        fileName: "a.txt",
        fileUrl: "https://example.test/a.txt",
        createdAt: 1,
      });
      return messageId;
    };
    const messageId = await addMessage(channelId);
    const inactiveMessageId = await addMessage(inactiveChannelId);
    return {
      memberId,
      outsiderId,
      clubId,
      otherClubId,
      inactiveClubId,
      channelId,
      inactiveChannelId,
      orphanChannelId,
      messageId,
      inactiveMessageId,
    };
  });
  return {
    t,
    ...ids,
    member: t.withIdentity({ subject: ids.memberId }),
    outsider: t.withIdentity({ subject: ids.outsiderId }),
  };
}

describe("channel gate error mapping", () => {
  test("posting names what is missing: channel, club, then membership", async () => {
    const { t, member, outsider, channelId, orphanChannelId } = await fixture();
    const deletedChannelId = await t.run(async (ctx) => {
      const channel = (await ctx.db.get(channelId))!;
      const { _id, _creationTime, ...fields } = channel;
      void _id;
      void _creationTime;
      const id = await ctx.db.insert("clubChannels", fields);
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      member.mutation(api.clubs.channels.postMessage, { channelId: deletedChannelId, body: "hi" }),
    ).rejects.toThrow("Channel not found");
    await expect(
      member.mutation(api.clubs.channels.postMessage, { channelId: orphanChannelId, body: "hi" }),
    ).rejects.toThrow("Club not found");
    await expect(
      outsider.mutation(api.clubs.channels.postMessage, { channelId, body: "hi" }),
    ).rejects.toThrow("Not a club member");
    await member.mutation(api.clubs.channels.postMessage, { channelId, body: "hi" });
  });

  test("marking read applies the same mapping", async () => {
    const { outsider, orphanChannelId, channelId, messageId } = await fixture();
    await expect(
      outsider.mutation(api.clubs.channels.markRead, { channelId, throughMessageId: messageId }),
    ).rejects.toThrow("Not a club member");
    await expect(
      outsider.mutation(api.clubs.channels.markRead, {
        channelId: orphanChannelId,
        throughMessageId: messageId,
      }),
    ).rejects.toThrow("Club not found");
  });

  test("reads hide a deactivated club's channel, attachment listing and writes do not", async () => {
    const { member, inactiveClubId, inactiveChannelId, inactiveMessageId } = await fixture();
    expect(
      await member.query(api.clubs.channels.getMessage, {
        clubId: inactiveClubId,
        channelId: inactiveChannelId,
        messageId: inactiveMessageId,
      }),
    ).toBeNull();
    const attachments = await member.query(api.clubs.shared.listChannelAttachments, {
      clubId: inactiveClubId,
      channelId: inactiveChannelId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(attachments.page).toHaveLength(1);
    await member.mutation(api.clubs.channels.postMessage, { channelId: inactiveChannelId, body: "still open" });
  });

  test("attachment listing answers empty instead of throwing", async () => {
    const { member, outsider, clubId, otherClubId, channelId } = await fixture();
    const list = (who: typeof member, club: typeof clubId, channel: typeof channelId) =>
      who.query(api.clubs.shared.listChannelAttachments, {
        clubId: club,
        channelId: channel,
        paginationOpts: { numItems: 10, cursor: null },
      });

    expect((await list(member, clubId, channelId)).page).toHaveLength(1);
    expect(await list(outsider, clubId, channelId)).toMatchObject({ page: [], isDone: true });
    expect(await list(member, otherClubId, channelId)).toMatchObject({ page: [], isDone: true });
  });
});

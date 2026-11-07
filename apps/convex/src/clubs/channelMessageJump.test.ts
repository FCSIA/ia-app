/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

describe("inline reply jump lookup", () => {
  test("only resolves root messages the viewer may already read", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const makeUser = (uniqueId: string) => insertUser(ctx, { uniqueId, lastName: "User" });
      const memberId = await makeUser("MEMBER");
      const outsiderId = await makeUser("OUTSIDER");

      const clubId = await ctx.db.insert("clubs", {
        name: "Jump Club",
        joinPolicy: "OPEN",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const roleId = await ctx.db.insert("clubRoles", {
        clubId,
        name: "Member",
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: true,
        showInDirectory: false,
        position: 0,
        createdById: memberId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("clubMembers", {
        clubId,
        userId: memberId,
        roleId,
        joinedAt: now,
      });

      const makeChannel = (name: string) =>
        ctx.db.insert("clubChannels", {
          clubId,
          accessPolicyVersion: 2,
          accessRoleIds: [],
          postingPolicy: "AUDIENCE" as const,
          name,
          visibility: "PUBLIC" as const,
          createdById: memberId,
          createdAt: now,
          updatedAt: now,
        });
      const channelId = await makeChannel("General");
      const otherChannelId = await makeChannel("Other");

      const makeMessage = (
        target: Id<"clubChannels">,
        body: string,
        parentMessageId?: Id<"clubChannelMessages">,
      ) =>
        ctx.db.insert("clubChannelMessages", {
          channelId: target,
          authorId: memberId,
          parentMessageId,
          body,
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        });
      const rootId = await makeMessage(channelId, "root");
      const threadReplyId = await makeMessage(channelId, "thread reply", rootId);
      const otherChannelMessageId = await makeMessage(otherChannelId, "elsewhere");
      return {
        memberId,
        outsiderId,
        clubId,
        channelId,
        rootId,
        threadReplyId,
        otherChannelMessageId,
      };
    });

    const jump = async (
      userId: Id<"users">,
      messageId: Id<"clubChannelMessages">,
    ) =>
      (
        await t.withIdentity({ subject: userId }).query(api.clubs.channels.getMessage, {
          clubId: ids.clubId,
          channelId: ids.channelId,
          messageId,
        })
      )?.body ?? null;

    expect({
      member: await jump(ids.memberId, ids.rootId),
      outsider: await jump(ids.outsiderId, ids.rootId),
      crossChannel: await jump(ids.memberId, ids.otherChannelMessageId),
      threadReply: await jump(ids.memberId, ids.threadReplyId),
    }).toEqual({
      member: "root",
      outsider: null,
      crossChannel: null,
      threadReply: null,
    });
  });
});

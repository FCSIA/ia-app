/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { findJumpTargetMessage } from "./channels";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

const modules = import.meta.glob("../**/*.*s");

describe("inline reply jump lookup", () => {
  test("only resolves root messages the viewer may already read", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const now = 1;
      const makeUser = (uniqueId: string) =>
        ctx.db.insert("users", {
          uniqueId,
          firstName: uniqueId,
          lastName: "User",
          roles: ["STUDENT"],
          isStudent: true,
          isTeacherStaff: false,
          isStudentAdmin: false,
          isOtherRole: false,
          isActive: true,
          mustResetPassword: false,
          dashboardLayout: [],
          searchText: `${uniqueId} User`,
          createdAt: now,
          updatedAt: now,
        });
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

      const member = (await ctx.db.get(memberId))!;
      const outsider = (await ctx.db.get(outsiderId))!;
      const jump = async (
        userId: Id<"users">,
        lookupChannelId: Id<"clubChannels">,
        messageId: Id<"clubChannelMessages">,
      ) => {
        const user = userId === memberId ? member : outsider;
        const message = await findJumpTargetMessage(
          ctx,
          user,
          clubId,
          lookupChannelId,
          messageId,
        );
        return message?.body ?? null;
      };

      return {
        member: await jump(memberId, channelId, rootId),
        outsider: await jump(outsiderId, channelId, rootId),
        crossChannel: await jump(memberId, channelId, otherChannelMessageId),
        threadReply: await jump(memberId, channelId, threadReplyId),
      };
    });

    expect(result).toEqual({
      member: "root",
      outsider: null,
      crossChannel: null,
      threadReply: null,
    });
  });
});

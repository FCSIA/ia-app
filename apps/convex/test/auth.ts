import { ConvexError } from "convex/values";
import type { Doc, Id } from "../src/_generated/dataModel";
import type { QueryCtx } from "../src/_generated/server";
import { hasAnyRole } from "../../shared/roles";

type CurrentUserModule = typeof import("../lib/currentUser");

/**
 * Replaces who-is-signed-in in `lib/currentUser` for convex-test: the user is
 * the `users` row named by the test identity's `subject`
 * (`t.withIdentity({ subject: userId })`). Use it as
 * `vi.mock("../../lib/currentUser", async (original) =>
 *   (await import("../../test/auth")).currentUserFromIdentity(await original()))`.
 *
 * `requireActive` also applies the production rules that an inactive account
 * is signed out and that a pending password reset blocks `getCurrentAppUser`.
 */
export function currentUserFromIdentity(
  actual: CurrentUserModule,
  options: { requireActive?: boolean } = {},
): CurrentUserModule {
  const unchecked = async (ctx: QueryCtx): Promise<Doc<"users"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    return options.requireActive && !user?.isActive ? null : user;
  };
  const getMaybeCurrentAppUser = options.requireActive
    ? async (ctx: QueryCtx) => {
        const user = await unchecked(ctx);
        actual.assertPasswordResetComplete(user);
        return user;
      }
    : unchecked;
  return {
    ...actual,
    getMaybeCurrentAppUser,
    getMaybeCurrentAppUserUnchecked: unchecked,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const user = await getMaybeCurrentAppUser(ctx);
      if (!user) throw new ConvexError("Unauthenticated");
      return user;
    },
    viewerWithRoles: async (ctx, allowed) => {
      const user = await getMaybeCurrentAppUser(ctx);
      return user && hasAnyRole(user.roles, allowed) ? user : null;
    },
  };
}

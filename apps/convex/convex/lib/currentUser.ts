import { ConvexError } from "convex/values";
import { authComponent } from "../auth";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { AppRole } from "./roles";

type Ctx = QueryCtx | MutationCtx;

export const toPublicUser = (user: Doc<"users">) => ({
  id: user._id,
  uniqueId: user.uniqueId,
  firstName: user.firstName,
  lastName: user.lastName,
  roles: user.roles,
  role: user.roles[0] ?? null,
  gradeLevel: user.gradeLevel ?? null,
  major: user.major ?? null,
  minor: user.minor ?? null,
  email: user.email ?? null,
  isActive: user.isActive,
  mustResetPassword: user.mustResetPassword,
  dashboardLayout: user.dashboardLayout,
});

export async function getCurrentAppUser(ctx: Ctx): Promise<Doc<"users">> {
  const authUser = await authComponent.getAuthUser(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
    .unique();

  if (!user) {
    throw new ConvexError("No app user is linked to this auth account.");
  }

  if (!user.isActive) {
    throw new ConvexError("User account is inactive.");
  }

  return user;
}

export function requireAnyRole(user: Doc<"users">, allowed: AppRole[]) {
  if (!user.roles.some((role) => allowed.includes(role))) {
    throw new ConvexError("Forbidden");
  }
}

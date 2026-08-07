import { ConvexError } from "convex/values";
import { authComponent } from "../src/auth";
import type { Doc } from "../src/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../src/_generated/server";
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
  directoryOptOut: user.directoryOptOut ?? false,
  mustResetPassword: user.mustResetPassword,
  dashboardLayout: user.dashboardLayout,
  avatarUrl: user.avatarUrl ?? null,
  customBackgroundUrl: user.customBackgroundUrl ?? null,
});

export async function getCurrentAppUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getMaybeCurrentAppUser(ctx);
  if (!user) {
    throw new ConvexError("Unauthenticated");
  }
  return user;
}

export async function getMaybeCurrentAppUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
    .unique();

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export function requireAnyRole(user: Doc<"users">, allowed: AppRole[]) {
  if (!requireAnyRoleSafe(user, allowed)) {
    throw new ConvexError("Forbidden");
  }
}

export function requireAnyRoleSafe(user: Doc<"users">, allowed: AppRole[]): boolean {
  return user.roles.some((role) => allowed.includes(role));
}

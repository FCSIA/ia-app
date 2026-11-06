import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../src/_generated/dataModel";
import type { MutationCtx } from "../src/_generated/server";
import { classifyRoles, searchText } from "../src/users/_lib";

type UserRow = WithoutSystemFields<Doc<"users">>;

/**
 * A user row with the stored fields every user has: the role flags come from
 * `classifyRoles` and `searchText` from the names, as in production, so a
 * fixture cannot encode a state the app never produces. Pass any field to
 * override it.
 */
export function userRow(
  fields: Pick<UserRow, "uniqueId"> & Partial<UserRow>,
): UserRow {
  const roles = fields.roles ?? ["STUDENT"];
  const firstName = fields.firstName ?? fields.uniqueId;
  const lastName = fields.lastName ?? "Test";
  return {
    firstName,
    lastName,
    roles,
    ...classifyRoles(roles),
    isActive: true,
    mustResetPassword: false,
    dashboardLayout: [],
    searchText: searchText({
      uniqueId: fields.uniqueId,
      firstName,
      lastName,
      preferredName: fields.preferredName,
    }),
    createdAt: 1,
    updatedAt: 1,
    ...fields,
  };
}

export function insertUser(
  ctx: Pick<MutationCtx, "db">,
  fields: Pick<UserRow, "uniqueId"> & Partial<UserRow>,
): Promise<Id<"users">> {
  return ctx.db.insert("users", userRow(fields));
}

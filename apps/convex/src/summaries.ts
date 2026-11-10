import type { Doc } from "./_generated/dataModel";

type UserNameKey = "_id" | "firstName" | "lastName" | "preferredName";

/**
 * A user as other people see them: their name, plus whichever extra fields
 * the endpoint exposes. Every endpoint names its extras, so what it returns
 * stays visible at the call site.
 */
export function userSummary<Extra extends keyof Doc<"users"> = never>(
  user: Doc<"users">,
  ...extra: Extra[]
): Pick<Doc<"users">, UserNameKey | Extra> {
  const summary: Record<string, unknown> = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
  };
  for (const key of extra) summary[key] = user[key];
  return summary as Pick<Doc<"users">, UserNameKey | Extra>;
}

export function clubSummary(club: Pick<Doc<"clubs">, "_id" | "name">) {
  return { _id: club._id, name: club.name };
}

import { isAdmin, isStudent } from "~/apps/shared/roles";

export type AppPersona = "admin" | "student" | "staff" | "unknown";

/** Which Home and tab layout a viewer gets; admin wins over student. */
export function getAppPersona(
  user: { roles?: readonly string[] | null } | null | undefined,
): AppPersona {
  if (!user) return "unknown";
  if (isAdmin(user)) return "admin";
  if (isStudent(user)) return "student";
  return "staff";
}

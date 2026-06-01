import type { Infer } from "convex/values";
import { appRoleValidator } from "../src/validators";

export type AppRole = Infer<typeof appRoleValidator>;

export const USER_MANAGEMENT_ROLES = [
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly AppRole[];

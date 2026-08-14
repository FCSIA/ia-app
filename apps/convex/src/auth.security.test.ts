import { describe, expect, test } from "vitest";
import { disabledAdminHttpPaths } from "./auth";

const sensitiveAdminPaths = [
  "/admin/set-role",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/get-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
] as const;

describe("Better Auth HTTP hardening", () => {
  test.each(sensitiveAdminPaths)("disables %s", (path) => {
    expect(disabledAdminHttpPaths).toContain(path);
  });
});

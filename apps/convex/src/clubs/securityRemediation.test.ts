import { describe, expect, test } from "vitest";
import { canChangePrivateChannelVisibility } from "./channels";
import { generateSecureJoinCode } from "./invitations";

describe("club security remediation", () => {
  test("does not let a non-member leader expose a private channel", () => {
    expect(canChangePrivateChannelVisibility({ isSponsor: false, isAdmin: false, isExplicitMember: false })).toBe(false);
    expect(canChangePrivateChannelVisibility({ isSponsor: false, isAdmin: false, isExplicitMember: true })).toBe(true);
  });

  test("generates long cryptographic join codes from an unambiguous alphabet", () => {
    const codes = new Set(Array.from({ length: 20 }, generateSecureJoinCode));
    expect(codes.size).toBe(20);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
  });
});

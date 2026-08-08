import type { Id } from "../_generated/dataModel";
import type { FriendShareLinkMode } from "../validators";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ExistingFriendshipState = {
  requesterId: Id<"users">;
  addresseeId: Id<"users">;
  status: "PENDING" | "ACCEPTED";
};

export type FriendLinkRedemptionAction =
  | "ALREADY_FRIENDS"
  | "KEEP_PENDING"
  | "ACCEPT_PENDING"
  | "CREATE_REQUEST"
  | "CREATE_ACCEPTED";

export function generateOpaqueFriendToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const encoded = btoa(String.fromCharCode(...bytes));
  return encoded.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function isValidOpaqueFriendToken(token: string) {
  return TOKEN_PATTERN.test(token);
}

export async function digestFriendToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decideFriendLinkRedemption(input: {
  mode: FriendShareLinkMode;
  ownerId: Id<"users">;
  redeemerId: Id<"users">;
  existing: ExistingFriendshipState | null;
}): FriendLinkRedemptionAction {
  if (!input.existing) {
    return input.mode === "AUTO_ACCEPT" ? "CREATE_ACCEPTED" : "CREATE_REQUEST";
  }
  if (input.existing.status === "ACCEPTED") return "ALREADY_FRIENDS";
  if (input.mode === "AUTO_ACCEPT") return "ACCEPT_PENDING";

  return "KEEP_PENDING";
}

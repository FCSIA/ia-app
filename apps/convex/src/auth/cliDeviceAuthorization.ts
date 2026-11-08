import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";

// The only client allowed to start a device sign-in. The command-line client
// sends it as `client_id` when it requests a code.
export const CLI_CLIENT_ID = "fcsia-cli";

export function isCliClient(clientId: string) {
  return clientId === CLI_CLIENT_ID;
}

export function cliDeviceVerificationUri(siteUrl: string) {
  return new URL("/device", siteUrl).toString();
}

// RFC 8628 device authorization for the command-line client. The terminal
// requests a code, a signed-in person approves it on the web, and the terminal
// receives an ordinary Better Auth session token. Convex functions keep
// authorizing through `getCurrentAppUser`, so a CLI session has exactly the
// permissions of the person who approved it.
export function createCliDeviceAuthorization(siteUrl: string) {
  return deviceAuthorization({
    expiresIn: "10m",
    interval: "5s",
    validateClient: isCliClient,
    verificationUri: cliDeviceVerificationUri(siteUrl),
  });
}

export function requestsPreboundUser(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    "user_id" in body &&
    (body as { user_id?: unknown }).user_id !== undefined
  );
}

// Better Auth lets a caller pre-bind a device code to a user ID. The CLI never
// needs that, and accepting it would let anyone probe or target accounts by ID.
export function createCliDeviceCodeGuard(): BetterAuthPlugin {
  return {
    id: "cli-device-code-guard",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/device/code",
          handler: createAuthMiddleware(async (ctx) => {
            if (requestsPreboundUser(ctx.body)) {
              throw new APIError("BAD_REQUEST", {
                error: "invalid_request",
                error_description: "Device codes can't be bound to a user.",
              });
            }
          }),
        },
      ],
    },
  };
}

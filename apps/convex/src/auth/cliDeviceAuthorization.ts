import type { GenericCtx } from "@convex-dev/better-auth";
import { isRunMutationCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { trustedClientIp } from "./loginRateLimitPlugin";

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
  const plugin = deviceAuthorization({
    expiresIn: "10m",
    interval: "5s",
    validateClient: isCliClient,
    verificationUri: cliDeviceVerificationUri(siteUrl),
  });
  // Every route looks codes up by `deviceCode` or `userCode`, and the cleanup
  // sweep ranges over `expiresAt`. The schema generator indexes unique and
  // sortable fields, so mark them; the plugin's own schema has no indexes.
  const fields = plugin.schema.deviceCode.fields;
  return {
    ...plugin,
    schema: {
      deviceCode: {
        ...plugin.schema.deviceCode,
        fields: {
          ...fields,
          deviceCode: { ...fields.deviceCode, unique: true },
          userCode: { ...fields.userCode, unique: true },
          expiresAt: { ...fields.expiresAt, sortable: true },
        },
      },
    },
  } satisfies BetterAuthPlugin;
}

export function requestsPreboundUser(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    "user_id" in body &&
    (body as { user_id?: unknown }).user_id !== undefined
  );
}

// Paths where a person enters, approves, or denies a code someone showed them.
export const DEVICE_LOOKUP_PATHS = ["/device", "/device/approve", "/device/deny"];

type LimitName = "deviceCodesByIp" | "deviceCodesGlobal" | "deviceLookupsByUser";

function rateLimited(retryAfterMs: number | null) {
  const seconds = Math.max(1, Math.ceil((retryAfterMs ?? 60_000) / 1000));
  return new APIError("TOO_MANY_REQUESTS", {
    error: "slow_down",
    error_description: `Too many sign-in codes. Try again in ${seconds} seconds.`,
  });
}

// Guards and bookkeeping around device sign-in:
// - refuses codes pre-bound to a user ID (the CLI never needs that, and it
//   would let anyone probe or target accounts by ID);
// - rate limits code requests per IP and overall, and code lookups per person;
// - tags the issued session with the CLI's client ID so people can list and
//   revoke CLI sign-ins, and sends them a security notice for each one.
export function createCliSignInPlugin(convexCtx: GenericCtx<DataModel>): BetterAuthPlugin {
  async function limit(name: LimitName, key: string) {
    if (!isRunMutationCtx(convexCtx)) return;
    const result = await convexCtx.runMutation(internal.users.cliSessions.limit, { name, key });
    if (!result.ok) throw rateLimited(result.retryAfter);
  }

  return {
    id: "cli-sign-in",
    schema: {
      session: {
        fields: {
          clientId: { type: "string", required: false, input: false },
        },
      },
    },
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
            await limit("deviceCodesGlobal", "deployment");
            await limit("deviceCodesByIp", trustedClientIp(ctx.request));
          }),
        },
        {
          matcher: (ctx) => DEVICE_LOOKUP_PATHS.includes(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            await limit(
              "deviceLookupsByUser",
              session ? `user:${session.user.id}` : `ip:${trustedClientIp(ctx.request)}`,
            );
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/device/token",
          handler: createAuthMiddleware(async (ctx) => {
            const issued = ctx.context.newSession;
            if (!issued || !isRunMutationCtx(convexCtx)) return;
            await ctx.context.internalAdapter.updateSession(issued.session.token, {
              clientId: CLI_CLIENT_ID,
            });
            await convexCtx.runMutation(internal.users.cliSessions.recordSignIn, {
              authUserId: issued.user.id,
              sessionId: issued.session.id,
              userAgent: ctx.request?.headers.get("user-agent")?.slice(0, 200) ?? undefined,
            });
          }),
        },
      ],
    },
  };
}

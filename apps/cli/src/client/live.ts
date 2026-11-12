import { ConvexClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { CliError } from "../core/errors";
import type { Runtime } from "../core/runtime";
import { exchangeForJwt } from "./auth";
import type { Connection } from "./session";

export interface LiveWatch {
  close(): Promise<void>;
}

/**
 * Subscribes to a query over the live websocket used by `follow`. The saved
 * session token is exchanged again whenever the short-lived Convex JWT
 * expires, so a watch can outlive one token.
 */
export function watch<Query extends FunctionReference<"query">>(
  runtime: Runtime,
  connection: Connection,
  reference: Query,
  args: FunctionArgs<Query>,
  onValue: (value: FunctionReturnType<Query>) => void,
  onError: (error: unknown) => void,
): LiveWatch {
  const client = new ConvexClient(connection.discovery.convexUrl, { logger: false });
  client.setAuth(
    async () => {
      const jwt = await exchangeForJwt(runtime, connection.discovery, connection.credential.token);
      if (!jwt) {
        throw new CliError("authentication", "session_expired", "Your sign-in expired while watching.", {
          userActionRequired: true,
        });
      }
      return jwt;
    },
    () => {},
  );
  const unsubscribe = client.onUpdate(reference, args, onValue, onError);
  return {
    async close() {
      unsubscribe();
      await client.close();
    },
  };
}

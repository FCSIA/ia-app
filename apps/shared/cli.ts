// Shared between the web app, which publishes it, and the command-line client,
// which refuses to run against a host that needs a newer CLI.

/** Path of the discovery document the CLI reads from a web host. */
export const CLI_DISCOVERY_PATH = "/.well-known/fcsia-cli.json";

/**
 * The oldest CLI release this deployment still supports. Raise it only when a
 * backend change breaks an older CLI; the CLI then exits with `cli_outdated`
 * and tells people to upgrade.
 */
export const MIN_CLI_VERSION = "0.1.0";

export type CliDiscoveryDocument = {
  service: "fcsia";
  /** Convex deployment URL for queries and mutations. */
  convexUrl: string;
  /** Convex HTTP actions origin, which serves `/api/auth/*`. */
  convexSiteUrl: string;
  appVersion: string;
  minCliVersion: string;
};

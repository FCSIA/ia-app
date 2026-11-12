import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend, HOST, type FakeBackendOptions } from "../fakeBackend";
import { run, type FakeRuntimeOptions } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-account-"));
});

afterEach(() => rmSync(config, { recursive: true, force: true }));

function setup(backendOptions: FakeBackendOptions = {}, secrets: Map<string, string> | null = new Map()) {
  const backend = fakeBackend(backendOptions);
  const invoke = (argv: string[], options: FakeRuntimeOptions = {}) =>
    run(argv, {
      fetch: backend.handle,
      secrets,
      ...options,
      env: { FCSIA_CONFIG_DIR: config, ...options.env },
    });
  return { backend, invoke, secrets };
}

const TERMINAL = { stdoutTTY: true, stderrTTY: true, stdinTTY: true };

describe("login", () => {
  test("shows the code, waits for approval, and saves the token in the credential store", async () => {
    const { invoke, backend, secrets } = setup({ pendingPolls: ["authorization_pending", "slow_down"] });
    const result = await invoke(["login"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`Page            ${HOST}/device\n`);
    expect(result.stderr).toContain("Code            ABCD-EFGH\n");
    expect(result.stderr).toContain("Signed in David Jones (STU050)");
    expect(backend.calls.filter((call) => call === "device token")).toHaveLength(3);
    expect(secrets!.get(`fcsia-cli/${HOST}`)).toBe("issued1");
    expect(existsSync(join(config, "credentials.json"))).toBe(false);
    const saved = JSON.parse(readFileSync(join(config, "config.json"), "utf8"));
    expect(saved.host).toBe(HOST);
    expect(saved.hosts[HOST].user).toEqual({ id: "user1", username: "STU050", name: "David Jones" });
  });

  test("opens the browser only for a person at this computer", async () => {
    const atTerminal = await setup().invoke(["login"], TERMINAL);
    expect(atTerminal.opened).toEqual([`${HOST}/device?user_code=ABCDEFGH`]);
    const overSsh = await setup().invoke(["login"], { ...TERMINAL, env: { SSH_CONNECTION: "1 2 3 4" } });
    expect(overSsh.opened).toEqual([]);
    const declined = await setup().invoke(["login", "--no-browser"], TERMINAL);
    expect(declined.opened).toEqual([]);
    const piped = await setup().invoke(["login"]);
    expect(piped.opened).toEqual([]);
  });

  test("with --json, announces the code on stderr and prints one result document", async () => {
    const result = await setup().invoke(["login", "--json"]);
    expect(result.code).toBe(0);
    const [announcement, ...rest] = result.stderr.trim().split("\n");
    expect(rest).toEqual([]);
    expect(JSON.parse(announcement!)).toMatchObject({
      status: "action_required",
      reason: "approval_required",
      userCode: "ABCD-EFGH",
      verificationUri: `${HOST}/device`,
    });
    expect(JSON.parse(result.stdout)).toEqual({
      outcome: "signed_in",
      host: HOST,
      user: { id: "user1", username: "STU050", name: "David Jones", roles: ["STUDENT"] },
      credentialStore: "keychain",
    });
  });

  test("falls back to a private file when there's no credential store", async () => {
    const result = await setup({}, null).invoke(["login", "--json"]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      credentialStore: "file",
      warnings: [expect.objectContaining({ reason: "credential_store_unavailable" })],
    });
    const path = join(config, "credentials.json");
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ tokens: { [HOST]: "issued1" } });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test("is a no-op when already signed in", async () => {
    const { invoke, backend } = setup();
    await invoke(["login"]);
    const again = await invoke(["login", "--json"]);
    expect(JSON.parse(again.stdout).outcome).toBe("unchanged");
    expect(backend.calls.filter((call) => call === "device code")).toHaveLength(1);
  });

  test("a denied or expired code fails with its own reason", async () => {
    const denied = await setup({ pendingPolls: ["access_denied"] }).invoke(["login", "--json"]);
    expect(denied.code).toBe(1);
    expect(JSON.parse(denied.stderr.trim().split("\n").at(-1)!).reason).toBe("sign_in_denied");
    const expired = await setup({ pendingPolls: ["expired_token"] }).invoke(["login", "--json"]);
    expect(JSON.parse(expired.stderr.trim().split("\n").at(-1)!).reason).toBe("sign_in_expired");
  });

  test("refuses a site that needs a newer CLI or isn't IA App", async () => {
    // Development builds skip the version check, so only the shape is tested.
    const notIa = await setup({ discoveryStatus: 404 }).invoke(["login", "--json"]);
    expect(JSON.parse(notIa.stderr).reason).toBe("unsupported_host");
    const http = await setup().invoke(["login", "--host", "http://example.com", "--json"]);
    expect(http.code).toBe(2);
    expect(JSON.parse(http.stderr).reason).toBe("invalid_host");
  });

  test("an unreachable site is a network error", async () => {
    const result = await run(["login", "--json"], { env: { FCSIA_CONFIG_DIR: config } });
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ reason: "network_error", retryable: true });
  });
});

describe("whoami", () => {
  test("prints the username on stdout and details on stderr", async () => {
    const { invoke } = setup();
    await invoke(["login"]);
    const result = await invoke(["whoami"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("STU050\n");
    expect(result.stderr).toContain("Roles           student");
  });

  test("explains how to sign in when there's no sign-in", async () => {
    const result = await setup().invoke(["whoami"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toBe(`Error: You're not signed in to ${HOST}.\n\nSign in:\n  fcsia login\n`);
  });

  test("a revoked sign-in is session_expired; a bad FCSIA_TOKEN is invalid_token", async () => {
    const { invoke, backend } = setup();
    await invoke(["login"]);
    backend.validTokens.clear();
    expect(JSON.parse((await invoke(["whoami", "--json"])).stderr).reason).toBe("session_expired");
    const fromEnvironment = await invoke(["whoami", "--json"], { env: { FCSIA_TOKEN: "nope" } });
    expect(JSON.parse(fromEnvironment.stderr).reason).toBe("invalid_token");
  });

  test("FCSIA_TOKEN works without any saved sign-in", async () => {
    const result = await setup({ validTokens: ["ci-token"] }).invoke(["whoami", "--json"], {
      env: { FCSIA_TOKEN: "ci-token" },
    });
    expect(JSON.parse(result.stdout).user.username).toBe("STU050");
  });

  test("--host suggestions keep the site", async () => {
    const result = await setup().invoke(["whoami", "--host", "app.fcsia.com"]);
    expect(result.stderr).toContain("fcsia login --host https://app.fcsia.com");
  });
});

describe("logout", () => {
  test("ends the server session, then removes the saved sign-in", async () => {
    const { invoke, backend, secrets } = setup();
    await invoke(["login"]);
    const result = await invoke(["logout", "--json"]);
    expect(JSON.parse(result.stdout)).toEqual({ outcome: "signed_out", host: HOST, server: "ended", local: "removed" });
    expect(backend.validTokens.has("issued1")).toBe(false);
    expect(secrets!.size).toBe(0);
    expect(JSON.parse(readFileSync(join(config, "config.json"), "utf8")).host).toBeUndefined();
  });

  test("still signs out locally when the site can't be reached, with a warning", async () => {
    const { invoke } = setup();
    await invoke(["login"]);
    const offline = await run(["logout", "--json"], {
      env: { FCSIA_CONFIG_DIR: config, FCSIA_HOST: "https://offline.example.test" },
    });
    expect(offline.code).toBe(0);
    expect(JSON.parse(offline.stdout)).toMatchObject({ outcome: "unchanged" });

    const unreachable = await invoke(["logout", "--json"], { fetch: () => Promise.reject(new TypeError("down")) });
    expect(JSON.parse(unreachable.stdout)).toMatchObject({
      server: "unreachable",
      local: "removed",
      warnings: [expect.objectContaining({ reason: "server_sign_out_failed" })],
    });
  });

  test("without a sign-in is a no-op that exits 0", async () => {
    const result = await setup().invoke(["logout"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe(`Not signed in to ${HOST}.\n`);
  });
});

describe("sessions", () => {
  test("lists CLI sign-ins as a table that marks this one", async () => {
    const { invoke } = setup({ validTokens: ["other"] });
    await invoke(["login"]);
    const result = await invoke(["sessions", "list"]);
    const [header, ...rows] = result.stdout.trim().split("\n");
    expect(header).toBe("Session\tClient\tSigned in\tLast used");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.startsWith("issued-session1"))).toContain("(this one)");
  });

  test("revoking this CLI's own session also removes the saved sign-in", async () => {
    const { invoke, secrets } = setup({ validTokens: ["other"] });
    await invoke(["login"]);
    const other = await invoke(["sessions", "revoke", "session1", "--json"]);
    expect(JSON.parse(other.stdout).outcome).toBe("revoked");
    expect(secrets!.size).toBe(1);

    const self = await invoke(["sessions", "revoke", "issued-session1"]);
    expect(self.code).toBe(0);
    expect(self.stderr).toContain("you're now signed out here too");
    expect(self.stdout).toBe("issued-session1\n");
    expect(secrets!.size).toBe(0);
  });

  test("an unknown session ID is not_found with a way to list them", async () => {
    const { invoke } = setup();
    await invoke(["login"]);
    const result = await invoke(["sessions", "revoke", "nope"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("No CLI sign-in on your account has ID nope.");
    expect(result.stderr).toContain("fcsia sessions list");
  });
});

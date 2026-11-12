import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../testing";

let base: string;
let bin: string;
let other: string;
let config: string;

function executable(path: string) {
  writeFileSync(path, "#!/bin/sh\n");
  chmodSync(path, 0o755);
}

function installed(argv: string[], extra: { path?: string; json?: boolean } = {}) {
  return run(argv, {
    argv0: "fcsia",
    compiled: true,
    env: { PATH: extra.path ?? bin, FCSIA_CONFIG_DIR: config },
  });
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "fcsia-alias-"));
  bin = join(base, "bin");
  other = join(base, "other");
  config = join(base, "config");
  mkdirSync(bin);
  mkdirSync(other);
  executable(join(bin, "fcsia"));
});

afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("cli alias set", () => {
  test("links the alias beside the installed command and records it", async () => {
    const result = await installed(["cli", "alias", "set", "ia"]);
    expect(result.code).toBe(0);
    expect(readlinkSync(join(bin, "ia"))).toBe(join(bin, "fcsia"));
    expect(JSON.parse(readFileSync(join(config, "config.json"), "utf8")).alias).toEqual({
      name: "ia",
      path: join(bin, "ia"),
      target: join(bin, "fcsia"),
    });
    // Non-interactive runs print the bare identifier on stdout.
    expect(result.stdout).toBe("ia\n");
    expect(result.stderr).toContain("Set ia");
  });

  test("setting the same alias again is unchanged", async () => {
    await installed(["cli", "alias", "set", "ia"]);
    const result = await installed(["cli", "alias", "set", "ia", "--json"]);
    expect(JSON.parse(result.stdout).outcome).toBe("unchanged");
  });

  test("a new alias replaces the previous link", async () => {
    await installed(["cli", "alias", "set", "ia"]);
    const result = await installed(["cli", "alias", "set", "school", "--json"]);
    const document = JSON.parse(result.stdout);
    expect(document.outcome).toBe("set");
    expect(document.replaced.name).toBe("ia");
    expect(existsSync(join(bin, "ia"))).toBe(false);
    expect(lstatSync(join(bin, "school")).isSymbolicLink()).toBe(true);
  });

  test("refuses a name another program on PATH provides, unless forced", async () => {
    executable(join(other, "ia"));
    const path = `${bin}:${other}`;
    const refused = await installed(["cli", "alias", "set", "ia"], { path });
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(`Can't set alias ia. ${join(other, "ia")} already provides ia.`);
    expect(existsSync(join(bin, "ia"))).toBe(false);

    const forced = await installed(["cli", "alias", "set", "ia", "--force", "--json"], { path });
    expect(forced.code).toBe(0);
    expect(JSON.parse(forced.stdout).warnings).toEqual([
      expect.objectContaining({ reason: "alias_shadows_command" }),
    ]);
  });

  test("never replaces a file it didn't create, even with --force", async () => {
    writeFileSync(join(bin, "ia"), "someone else's file");
    const result = await installed(["cli", "alias", "set", "ia", "--force", "--json"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).reason).toBe("alias_conflict");
    expect(readFileSync(join(bin, "ia"), "utf8")).toBe("someone else's file");
  });

  test("warns when the chosen directory isn't on PATH", async () => {
    const elsewhere = join(base, "elsewhere");
    mkdirSync(elsewhere);
    const result = await installed(["cli", "alias", "set", "ia", "--dir", elsewhere, "--json"]);
    expect(JSON.parse(result.stdout).warnings).toEqual([
      expect.objectContaining({ reason: "alias_not_on_path" }),
    ]);
  });

  test("rejects names that aren't valid commands", async () => {
    for (const name of ["IA", "1ia", "cd", "fcsia", "ia/x"]) {
      const result = await installed(["cli", "alias", "set", name]);
      expect(result.code).toBe(2);
    }
  });

  test("explains that running from source can't add an alias", async () => {
    const result = await run(["cli", "alias", "set", "ia"], { env: { FCSIA_CONFIG_DIR: config } });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("This copy runs from source; install the CLI first.");
  });
});

describe("cli alias remove and inspect", () => {
  test("remove deletes only the link and clears the setting", async () => {
    await installed(["cli", "alias", "set", "ia"]);
    const result = await installed(["cli", "alias", "remove", "--json"]);
    expect(JSON.parse(result.stdout).outcome).toBe("removed");
    expect(existsSync(join(bin, "ia"))).toBe(false);
    expect(existsSync(join(bin, "fcsia"))).toBe(true);
    expect(JSON.parse(readFileSync(join(config, "config.json"), "utf8")).alias).toBeUndefined();
  });

  test("remove without an alias is a no-op that exits 0", async () => {
    const result = await installed(["cli", "alias", "remove", "--json"]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ alias: null, outcome: "unchanged" });
  });

  test("inspect reports the alias, or null", async () => {
    expect(JSON.parse((await installed(["cli", "alias", "inspect", "--json"])).stdout)).toEqual({ alias: null });
    await installed(["cli", "alias", "set", "ia"]);
    expect(JSON.parse((await installed(["cli", "alias", "inspect", "--json"])).stdout).alias.name).toBe("ia");
  });

  test("keeps unrelated settings and reports broken settings files", async () => {
    mkdirSync(config);
    writeFileSync(join(config, "config.json"), JSON.stringify({ keep: true }));
    await installed(["cli", "alias", "set", "ia"]);
    expect(JSON.parse(readFileSync(join(config, "config.json"), "utf8")).keep).toBe(true);

    writeFileSync(join(config, "config.json"), "{ not json");
    const result = await installed(["cli", "alias", "inspect", "--json"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ reason: "invalid_config" });
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions, releaseAssetName } from "../core/upgrade";
import { run } from "../testing";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "fcsia-setup-"));
  tempDirectories.push(directory);
  return directory;
}

function releaseResponse(version = "9.8.7") {
  return new Response(
    JSON.stringify({
      tag_name: `v${version}`,
      html_url: `https://github.com/FCSIA/ia-app/releases/tag/v${version}`,
      assets: [
        {
          name: "fcsia-darwin-arm64",
          browser_download_url: "https://releases.example.test/fcsia-darwin-arm64",
        },
        {
          name: "SHA256SUMS",
          browser_download_url: "https://releases.example.test/SHA256SUMS",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("completion", () => {
  test("offers commands, then their options", async () => {
    const root = (await run(["__complete", "--", ""])).stdout;
    expect(root).toContain("announcements\tRead school and club announcements");

    const options = (await run(["__complete", "--", "announcements", "list", "--"])).stdout;
    expect(options).toContain("--limit\tHow many to show");
    expect(options).toContain("--json\tOutput the result as JSON");
  });

  test("prints a script for each supported shell", async () => {
    for (const shell of ["bash", "zsh", "fish"]) {
      const result = await run(["completion", shell]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("__complete");
    }
    const unsupported = await run(["completion", "powershell"]);
    expect(unsupported.code).toBe(2);
    expect(unsupported.stderr).toContain("isn't a supported shell");
  });
});

describe("upgrade", () => {
  test("compares versions and names release assets", () => {
    expect(compareVersions("1.2.3", "v1.10.0")).toBe(-1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("2.0.0-beta.1", "2.0.0")).toBe(-1);
    expect(releaseAssetName("darwin", "arm64")).toBe("fcsia-darwin-arm64");
    expect(releaseAssetName("win32", "x64")).toBe("fcsia-windows-x64.exe");
    expect(releaseAssetName("freebsd", "x64")).toBeNull();
  });

  test("--check reports the latest release without replacing anything", async () => {
    const result = await run(["upgrade", "--check", "--json"], {
      fetch: (request) => {
        expect(request.url).toBe("https://api.github.com/repos/FCSIA/ia-app/releases/latest");
        return releaseResponse();
      },
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      current: "0.0.0-dev",
      latest: "9.8.7",
      updateAvailable: true,
    });
  });

  test("replaces a compiled copy after verifying the checksum", async () => {
    const directory = tempDirectory();
    const execPath = join(directory, "fcsia");
    const binary = new TextEncoder().encode("new fcsia binary");
    const checksum = createHash("sha256").update(binary).digest("hex");
    writeFileSync(execPath, "old fcsia binary");

    const result = await run(["upgrade", "--json"], {
      compiled: true,
      execPath,
      platform: "darwin",
      arch: "arm64",
      fetch: (request) => {
        if (request.url === "https://api.github.com/repos/FCSIA/ia-app/releases/latest") {
          return releaseResponse();
        }
        if (request.url === "https://releases.example.test/fcsia-darwin-arm64") {
          return new Response(binary);
        }
        if (request.url === "https://releases.example.test/SHA256SUMS") {
          return new Response(`${checksum}  fcsia-darwin-arm64\n`);
        }
        return new Response("not found", { status: 404 });
      },
    });

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      outcome: "updated",
      previous: "0.0.0-dev",
      version: "9.8.7",
    });
    expect(readFileSync(execPath)).toEqual(Buffer.from(binary));
  });
});

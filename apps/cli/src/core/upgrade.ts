import { createHash } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { CliError } from "./errors";
import type { Runtime } from "./runtime";

const REPOSITORY = "FCSIA/ia-app";
const LATEST_RELEASE_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const CHECKSUMS_ASSET = "SHA256SUMS";

export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface Release {
  version: string;
  url: string;
  assets: ReleaseAsset[];
}

function releasePage(version: string) {
  return `https://github.com/${REPOSITORY}/releases/tag/v${version}`;
}

function parts(version: string) {
  const [core = "", ...rest] = version.replace(/^v/, "").split("-");
  return {
    numbers: core.split(".").map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? value : 0;
    }),
    prerelease: rest.join("-"),
  };
}

/** Compares `MAJOR.MINOR.PATCH` versions, with any prerelease below its release. */
export function compareVersions(left: string, right: string) {
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < Math.max(a.numbers.length, b.numbers.length); index += 1) {
    const difference = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease) < 0 ? -1 : 1;
}

/** The release asset for this machine, or null when no build exists. */
export function releaseAssetName(platform: NodeJS.Platform, arch: string) {
  if (arch !== "x64" && arch !== "arm64") return null;
  if (platform === "darwin" || platform === "linux") return `fcsia-${platform}-${arch}`;
  if (platform === "win32") return `fcsia-windows-${arch}.exe`;
  return null;
}

function assetList(value: unknown): ReleaseAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { name, browser_download_url: url } = entry as Record<string, unknown>;
    return typeof name === "string" && typeof url === "string" ? [{ name, url }] : [];
  });
}

export async function fetchLatestRelease(fetchImpl: Runtime["fetch"]): Promise<Release> {
  let response: Response;
  try {
    response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fcsia-cli",
      },
    });
  } catch {
    throw new CliError("network", "release_check_failed", "Couldn't reach GitHub to check for a new version.", {
      retryable: true,
      next: [{ benefit: "Try again", argv: ["upgrade", "--check"] }],
    });
  }

  if (response.status === 404) {
    throw new CliError("not_found", "release_not_found", "No fcsia release is published yet.", {
      next: [{ benefit: "Try again later", argv: ["upgrade", "--check"] }],
    });
  }
  if (!response.ok) {
    throw new CliError(
      "network",
      "release_check_failed",
      `GitHub couldn't answer the version check (HTTP ${response.status}).`,
      {
        retryable: response.status === 429 || response.status >= 500,
        ...(response.headers.get("retry-after")
          ? { retryAfter: Number(response.headers.get("retry-after")) || undefined }
          : {}),
        next: [{ benefit: "Try again", argv: ["upgrade", "--check"] }],
      },
    );
  }

  let body: { tag_name?: unknown; html_url?: unknown; assets?: unknown };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new CliError("network", "release_check_failed", "GitHub sent a version check the CLI couldn't read.", {
      retryable: true,
    });
  }
  if (typeof body.tag_name !== "string" || body.tag_name === "") {
    throw new CliError("network", "release_check_failed", "GitHub sent a release without a version.", {
      retryable: true,
    });
  }
  const version = body.tag_name.replace(/^v/, "");
  return {
    version,
    url: typeof body.html_url === "string" ? body.html_url : releasePage(version),
    assets: assetList(body.assets),
  };
}

async function download(fetchImpl: Runtime["fetch"], asset: ReleaseAsset, label: string) {
  let response: Response;
  try {
    response = await fetchImpl(asset.url, { headers: { "User-Agent": "fcsia-cli" } });
  } catch {
    throw new CliError("network", "download_failed", `Couldn't download ${label}.`, { retryable: true });
  }
  if (!response.ok) {
    throw new CliError("network", "download_failed", `Couldn't download ${label} (HTTP ${response.status}).`, {
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  return new Uint8Array(await response.arrayBuffer());
}

function checksumFor(text: string, name: string) {
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (match?.[2] === name) return match[1]!.toLowerCase();
  }
  return null;
}

/**
 * Downloads the matching binary next to the running program and verifies it
 * against the release's SHA256SUMS before anything is replaced.
 */
export async function stageBinary(
  fetchImpl: Runtime["fetch"],
  release: Release,
  assetName: string,
  destination: string,
) {
  const binary = release.assets.find((asset) => asset.name === assetName);
  if (!binary) {
    throw new CliError(
      "platform",
      "asset_missing",
      `The ${release.version} release has no build for this machine (${assetName}).`,
      { next: [{ benefit: "See the release", argv: ["upgrade", "--check"] }] },
    );
  }
  const checksums = release.assets.find((asset) => asset.name === CHECKSUMS_ASSET);
  if (!checksums) {
    throw new CliError(
      "platform",
      "checksum_missing",
      `The ${release.version} release has no ${CHECKSUMS_ASSET}, so the download can't be verified.`,
    );
  }

  const [binaryBytes, checksumsBytes] = await Promise.all([
    download(fetchImpl, binary, assetName),
    download(fetchImpl, checksums, CHECKSUMS_ASSET),
  ]);
  const expected = checksumFor(new TextDecoder().decode(checksumsBytes), assetName);
  if (!expected) {
    throw new CliError(
      "platform",
      "checksum_missing",
      `${CHECKSUMS_ASSET} has no entry for ${assetName}, so the download can't be verified.`,
    );
  }
  const actual = createHash("sha256").update(binaryBytes).digest("hex");
  if (actual !== expected) {
    throw new CliError(
      "platform",
      "checksum_mismatch",
      `The ${assetName} download didn't match its checksum, so it was discarded.`,
      { retryable: true },
    );
  }

  try {
    await writeFile(destination, binaryBytes, { mode: 0o755 });
  } catch (error) {
    throw new CliError("platform", "install_failed", `Couldn't write the new fcsia next to ${destination}.`, {
      data: { cause: error instanceof Error ? error.message : String(error) },
    });
  }
}

export function stagingBinary(execPath: string) {
  return join(dirname(execPath), `.${basename(execPath)}.new`);
}

/** Replaces the running program. The write happened first, so this is the rename. */
export async function installBinary(runtime: Runtime, staged: string) {
  const target = runtime.execPath;
  const backup = `${target}.old`;
  try {
    if (runtime.platform === "win32") {
      // Windows won't let a running program be overwritten, but it can be
      // renamed. The backup is removed now or by the next upgrade.
      await unlink(backup).catch(() => {});
      await rename(target, backup);
      try {
        await rename(staged, target);
      } catch (error) {
        await rename(backup, target).catch(() => {});
        throw error;
      }
      await unlink(backup).catch(() => {});
      return;
    }
    await rename(staged, target);
  } catch (error) {
    await unlink(staged).catch(() => {});
    throw new CliError(
      "platform",
      "install_failed",
      `Couldn't replace ${target}. Check that you can write to its directory, or install fcsia again.`,
      {
        rows: [["Binary", target]],
        data: {
          cause: error instanceof Error ? error.message : String(error),
          ...(runtime.platform === "win32" ? { backup } : {}),
        },
      },
    );
  }
}

import { cliVersion, type Runtime } from "../core/runtime";
import {
  compareVersions,
  fetchLatestRelease,
  installBinary,
  releaseAssetName,
  stageBinary,
  stagingBinary,
} from "../core/upgrade";
import { CliError } from "../core/errors";
import type { CommandSpec } from "../registry/types";

function unsupported(runtime: Pick<Runtime, "platform" | "arch">) {
  return new CliError(
    "platform",
    "unsupported_platform",
    `There is no fcsia build for ${runtime.platform}-${runtime.arch}.`,
    {
      next: [{ benefit: "See the release", argv: ["upgrade", "--check"] }],
    },
  );
}

const upgrade: CommandSpec = {
  kind: "command",
  name: "upgrade",
  summary: "Update fcsia to the latest release",
  section: "Setup",
  json: true,
  options: [
    {
      name: "check",
      type: "boolean",
      description: "Only report whether a newer version exists",
    },
  ],
  examples: [
    { description: "See whether a new version exists", argv: ["upgrade", "--check"] },
    { description: "Install the latest version", argv: ["upgrade"] },
  ],
  notes: [
    "Upgrading replaces the fcsia program itself, so it only works for a compiled copy from the install script or a release download. Copies installed with npm update with npm.",
  ],
  async run(context) {
    const { out, runtime } = context;
    const current = cliVersion();
    const check = context.options.check === true;

    if (!check && !runtime.compiled) {
      throw new CliError(
        "platform",
        "not_compiled",
        "This copy of fcsia runs from source, so it can't replace itself. Update the source instead.",
        { rows: [["Running", runtime.execPath]] },
      );
    }

    const release = await fetchLatestRelease(runtime.fetch);
    const updateAvailable = compareVersions(current, release.version) < 0;

    if (check) {
      if (out.json) {
        out.document({
          current,
          latest: release.version,
          updateAvailable,
          release: release.url,
        });
        return;
      }
      out.detail([
        ["Current", current],
        ["Latest", release.version],
        ["Status", updateAvailable ? "Update available" : "Up to date"],
      ]);
      if (updateAvailable && context.modes.guidance) {
        out.blank();
        out.next({ benefit: "Update", argv: ["upgrade"] });
      }
      return;
    }

    if (!updateAvailable) {
      if (out.json) {
        out.document({ outcome: "up_to_date", current, latest: release.version });
        return;
      }
      out.success("Up to date", `fcsia ${current}`);
      return;
    }

    const asset = releaseAssetName(runtime.platform, runtime.arch);
    if (!asset) throw unsupported(runtime);
    const staged = stagingBinary(runtime.execPath);

    out.text(`Downloading fcsia ${release.version} for ${runtime.platform}-${runtime.arch}...`);
    await stageBinary(runtime.fetch, release, asset, staged);
    await installBinary(runtime, staged);

    if (out.json) {
      out.document({
        outcome: "updated",
        previous: current,
        version: release.version,
        asset,
        release: release.url,
      });
      return;
    }
    out.success("Updated", `fcsia ${release.version}`);
    out.row("Was", current);
    out.row("Now", release.version);
  },
};

export const upgradeCommand = upgrade;

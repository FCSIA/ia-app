export function parseReleaseArgs(args) {
  const dryRun = args.includes("--dry-run");
  const releaseFlags = args.filter(
    (arg) => arg === "--minor" || arg === "--patch" || arg.startsWith("--set="),
  );

  if (args.some((arg) => arg !== "--dry-run" && !releaseFlags.includes(arg))) {
    throw new Error("supported options are --minor, --patch, --set=MAJOR.MINOR.PATCH, and --dry-run");
  }
  if (releaseFlags.length > 1) throw new Error("choose at most one version option");

  return { dryRun, releaseFlags };
}

import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Icon Composer is the canonical source for the Apple app icon. Export its
// iOS Default rendition at 1024pt/1x, then use that lossless PNG for surfaces
// that cannot consume a layered .icon file (web, Android, and React Native).
const defaultSourcePath = path.join(root, "icon-composer/IA Orbit-flattened.png");
const darkSourcePath = path.join(root, "icon-composer/IA Orbit-dark.png");
const iconComposerPath = path.join(root, "icon-composer/IA Orbit.icon");
const checkOnly = process.argv.includes("--check");

const defaultSource = await readFile(defaultSourcePath);
const darkSource = await readFile(darkSourcePath);
const iconComposerFiles = [
  "icon.json",
  path.join("Assets", "Untitled design.png"),
];

async function squareIcon(source, size) {
  return await sharp(source)
    .resize(size, size, { fit: "fill" })
    .png()
    .toBuffer();
}

async function favicon(source) {
  const pngs = await Promise.all(
    [16, 32].map((size) => sharp(source).resize(size, size, { fit: "fill" }).png().toBuffer()),
  );
  const headerSize = 6;
  const directorySize = pngs.length * 16;
  const header = Buffer.alloc(headerSize + directorySize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = headerSize + directorySize;
  pngs.forEach((png, index) => {
    const entry = headerSize + index * 16;
    const size = index === 0 ? 16 : 32;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...pngs]);
}

async function monochromeMask(size) {
  return await sharp(defaultSource)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .grayscale()
    .threshold(235)
    .png()
    .toBuffer();
}

async function transparentPhoenix(size, color) {
  const mask = await monochromeMask(size);
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: color,
    },
  })
    .joinChannel(mask)
    .png()
    .toBuffer();
}

const outputs = [
  ["apps/web/public/favicon.ico", await favicon(defaultSource)],
  ["apps/web/public/favicon-dark.ico", await favicon(darkSource)],
  ["apps/web/public/icons/ia-orbit-default.png", await squareIcon(defaultSource, 1024)],
  ["apps/web/public/icons/ia-orbit-dark.png", await squareIcon(darkSource, 1024)],
  ["apps/web/public/icons/ia-orbit-default-192.png", await squareIcon(defaultSource, 192)],
  ["apps/web/public/icons/ia-orbit-default-512.png", await squareIcon(defaultSource, 512)],
  ["apps/web/public/icons/ia-orbit-dark-192.png", await squareIcon(darkSource, 192)],
  ["apps/web/public/icons/ia-orbit-dark-512.png", await squareIcon(darkSource, 512)],
  ["apps/mobile/assets/ia-orbit-default.png", await squareIcon(defaultSource, 1024)],
  ["apps/mobile/assets/ia-orbit-dark.png", await squareIcon(darkSource, 1024)],
  [
    "apps/mobile/assets/ia-orbit-adaptive.png",
    await squareIcon(defaultSource, 1024),
  ],
  [
    "apps/mobile/assets/ia-orbit-notification.png",
    await transparentPhoenix(96, { r: 255, g: 255, b: 255 }),
  ],
  [
    "apps/mobile/assets/ia-orbit-splash.png",
    await squareIcon(defaultSource, 512),
  ],
  ...await Promise.all(iconComposerFiles.map(async (relativePath) => [
    path.join("apps/mobile/assets/ia-orbit.icon", relativePath),
    await readFile(path.join(iconComposerPath, relativePath)),
  ])),
];

const stale = [];
for (const [relativePath, expected] of outputs) {
  const outputPath = path.join(root, relativePath);
  if (checkOnly) {
    try {
      await access(outputPath, constants.R_OK);
      const actual = await readFile(outputPath);
      if (!actual.equals(expected)) stale.push(relativePath);
    } catch {
      stale.push(relativePath);
    }
    continue;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
}

if (stale.length > 0) {
  throw new Error(
    `Brand assets are stale. Run pnpm brand:generate:\n${stale.join("\n")}`,
  );
}

console.log(
  checkOnly
    ? `Verified ${outputs.length} generated brand assets.`
    : `Generated ${outputs.length} brand assets from Icon Composer exports.`,
);

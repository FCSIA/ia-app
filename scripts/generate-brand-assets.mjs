import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "apps/web/public/icons/logo.png");
const checkOnly = process.argv.includes("--check");

const source = await readFile(sourcePath);

async function squareIcon(size) {
  return await sharp(source)
    .resize(size, size, { fit: "fill" })
    .png()
    .toBuffer();
}

async function phoenixMask(size) {
  return await sharp(source)
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .grayscale()
    .threshold(235)
    .png()
    .toBuffer();
}

async function transparentPhoenix(size, color) {
  const mask = await phoenixMask(size);
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
  ["apps/web/public/icons/icon-192.png", await squareIcon(192)],
  ["apps/web/public/icons/icon-512.png", await squareIcon(512)],
  ["apps/mobile/assets/logo.png", await squareIcon(512)],
  ["apps/mobile/assets/icon.png", await squareIcon(1024)],
  [
    "apps/mobile/assets/adaptive-icon.png",
    await transparentPhoenix(1024, { r: 255, g: 255, b: 255 }),
  ],
  [
    "apps/mobile/assets/notification-icon.png",
    await transparentPhoenix(96, { r: 255, g: 255, b: 255 }),
  ],
  [
    "apps/mobile/assets/splash.png",
    await transparentPhoenix(512, { r: 249, g: 91, b: 1 }),
  ],
  [
    "apps/mobile/assets/ia-orbit.icon/Assets/phoenix.png",
    await transparentPhoenix(1024, { r: 255, g: 255, b: 255 }),
  ],
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
    : `Generated ${outputs.length} brand assets from ${path.relative(root, sourcePath)}.`,
);

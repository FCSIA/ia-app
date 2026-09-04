#!/usr/bin/env node
// Dither login artwork into warm day / cool night duotones with ordered Bayer grain.
//
// Usage:
//   node scripts/dither-login-images.mjs
//
// Inputs (committed originals):
//   apps/web/public/images/login-campus.webp            - glass entrance, natural color
//   apps/web/public/images/login-campus-dithered.webp   - columns building, already warm-duotone day
//
// Outputs (committed, referenced by apps/web/src/app/login/login-images.ts):
//   apps/web/public/images/login-campus-day-dithered.webp      - warm duotone of glass entrance
//   apps/web/public/images/login-campus-night-dithered.webp    - cool duotone night of glass entrance
//   apps/web/public/images/login-columns-night-dithered.webp   - cool duotone night of columns building
//
// Palette intent: day maps luminance onto ember brown -> cream so every photo
// shares the existing orange cast; night maps onto deep ink -> moonlit blue.
// A 4x4 Bayer matrix adds a small ordered grain before the palette lookup so
// gradients (sky, glass) keep texture instead of banding.

import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imgDir = path.join(root, "apps/web/public/images");

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const DAY = {
  dark: [56, 26, 10],
  light: [255, 205, 150],
  gamma: [0.8, 1.15, 1.5],
  strength: 0.14,
  exposure: 1.12,
};

const NIGHT = {
  dark: [7, 11, 26],
  light: [186, 201, 233],
  gamma: [0.9, 1.05, 1.0],
  strength: 0.16,
  exposure: 0.55,
};

function applyDuotone(data, info, palette) {
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 3);
  const [dr, dg, db] = palette.dark;
  const [lr, lg, lb] = palette.light;
  const [gr, gg, gb] = palette.gamma;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const r = data[i] * palette.exposure;
      const g = data[i + 1] * palette.exposure;
      const b = data[i + 2] * palette.exposure;
      let v = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      v = Math.min(1, Math.max(0, v));
      const threshold = (BAYER_4X4[y % 4][x % 4] + 0.5) / 16 - 0.5;
      v = Math.min(1, Math.max(0, v + threshold * palette.strength));
      const o = (y * width + x) * 3;
      out[o] = Math.round(dr + (lr - dr) * Math.pow(v, gr));
      out[o + 1] = Math.round(dg + (lg - dg) * Math.pow(v, gg));
      out[o + 2] = Math.round(db + (lb - db) * Math.pow(v, gb));
    }
  }
  return { data: out, width, height };
}

async function dither(input, output, palette, width = 1774) {
  const { data, info } = await sharp(input)
    .resize({ width, withoutEnlargement: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data: mapped, width: w, height: h } = applyDuotone(data, info, palette);
  await sharp(mapped, { raw: { width: w, height: h, channels: 3 } })
    .webp({ quality: 82, effort: 6 })
    .toFile(output);
  console.log(`wrote ${path.relative(root, output)}`);
}

await dither(
  path.join(imgDir, "login-campus.webp"),
  path.join(imgDir, "login-campus-day-dithered.webp"),
  DAY,
);
await dither(
  path.join(imgDir, "login-campus.webp"),
  path.join(imgDir, "login-campus-night-dithered.webp"),
  NIGHT,
);
await dither(
  path.join(imgDir, "login-campus-dithered.webp"),
  path.join(imgDir, "login-columns-night-dithered.webp"),
  { ...NIGHT, exposure: 0.8 },
);

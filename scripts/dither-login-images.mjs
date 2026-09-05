#!/usr/bin/env node
// Dither login artwork into warm day / cool night duotones with ordered Bayer grain.
//
// Usage:
//   node scripts/dither-login-images.mjs
//
// Inputs (committed originals):
//   apps/web/public/images/login-campus.webp            - glass entrance, natural color
//   apps/web/public/images/login-campus-columns.webp    - columns building, smooth warm original
//
// Outputs (committed, referenced by apps/web/src/app/login/login-images.ts):
//   apps/web/public/images/login-campus-day-v2.webp       - warm duotone of glass entrance
//   apps/web/public/images/login-campus-night-v2.webp     - cool duotone night of glass entrance
//   apps/web/public/images/login-columns-day-v2.webp      - warm duotone of columns building
//   apps/web/public/images/login-columns-night-v2.webp    - cool duotone night of columns building
//
// The -v2 suffix is a cache-busting generation marker: browsers, the Next
// image cache, and deploys key on the filename, so regenerating under the
// same name would keep serving stale bytes. next/image rejects query strings
// on local sources, so the version must live in the filename itself.
//
// Palette intent: day maps luminance onto ember brown -> cream so every photo
// shares the existing orange cast; night maps onto deep ink -> moonlit blue.
// Luminance is quantized into stepped levels with an 8x8 Bayer threshold
// (3x3 source pixels per cell), so the dot pattern survives downscaling to
// login display sizes. Bump the ?v= query in login-images.ts whenever the
// outputs are regenerated, otherwise browsers and the Next image cache keep
// serving the previous bytes under the same filename.

import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const imgDir = path.join(root, "apps/web/public/images");

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const DAY = {
  dark: [56, 26, 10],
  light: [255, 205, 150],
  gamma: [0.8, 1.15, 1.5],
  levels: 4,
  spread: 1.0,
  // 3x3 source pixels per threshold cell: the dots stay visible after
  // downscaling to login display sizes instead of averaging away.
  cell: 3,
  exposure: 1.12,
};

const NIGHT = {
  dark: [7, 11, 26],
  light: [186, 201, 233],
  gamma: [0.9, 1.05, 1.0],
  levels: 4,
  spread: 1.0,
  cell: 3,
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
      // Ordered dither: quantize luminance into stepped levels with the Bayer
      // threshold deciding the step boundary, so gradients dissolve into a
      // visible dot pattern instead of smooth bands.
      const t = (BAYER_8X8[Math.floor(y / palette.cell) % 8][Math.floor(x / palette.cell) % 8] + 0.5) / 64;
      const levels = palette.levels;
      v = Math.min(1, Math.max(0, Math.floor(v * levels + t * palette.spread) / levels));
      const o = (y * width + x) * 3;
      out[o] = Math.round(dr + (lr - dr) * Math.pow(v, gr));
      out[o + 1] = Math.round(dg + (lg - dg) * Math.pow(v, gg));
      out[o + 2] = Math.round(db + (lb - db) * Math.pow(v, gb));
    }
  }
  return { data: out, width, height };
}

async function dither(input, output, palette, width = 1200) {
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
  path.join(imgDir, "login-campus-day-v2.webp"),
  DAY,
);
await dither(
  path.join(imgDir, "login-campus.webp"),
  path.join(imgDir, "login-campus-night-v2.webp"),
  NIGHT,
);
await dither(
  path.join(imgDir, "login-campus-columns.webp"),
  path.join(imgDir, "login-columns-day-v2.webp"),
  { ...DAY, exposure: 1.0 },
);
await dither(
  path.join(imgDir, "login-campus-columns.webp"),
  path.join(imgDir, "login-columns-night-v2.webp"),
  { ...NIGHT, exposure: 0.8 },
);

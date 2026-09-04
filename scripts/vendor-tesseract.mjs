#!/usr/bin/env node
/**
 * Copies the Tesseract OCR worker and WASM cores out of the installed
 * `tesseract.js` / `tesseract.js-core` packages into `apps/web/public/tesseract`
 * so the browser loads them same-origin.
 *
 * This runs at predev/prebuild instead of committing the binaries, which means:
 *   - the served assets always match the `tesseract.js` version in package.json,
 *   - no CDN origins are needed in the CSP,
 *   - git never rewrites their line endings (an earlier vendored copy of
 *     `*.wasm.js` was corrupted by CRLF normalization).
 *
 * `eng.traineddata.gz` is NOT shipped in any npm package, so it stays committed
 * under public/tesseract — see the README there for its source and checksum.
 */
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps/web/public/tesseract');

const workerSrc = join(dirname(require.resolve('tesseract.js/package.json')), 'dist/worker.min.js');
const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));

// The dialog calls createWorker(lang, OEM.LSTM_ONLY), so tesseract.js resolves a
// `*-lstm` core, picking the relaxedsimd / simd / plain variant from what the
// browser supports at runtime. All three must be present or OCR 404s.
const cores = [
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
];

mkdirSync(outDir, { recursive: true });
copyFileSync(workerSrc, join(outDir, 'worker.min.js'));
for (const name of cores) {
  const from = join(coreDir, name);
  if (!existsSync(from)) throw new Error(`Missing Tesseract core asset: ${from}`);
  copyFileSync(from, join(outDir, name));
}

const version = require('tesseract.js/package.json').version;
console.log(`vendored tesseract.js@${version} worker + ${cores.length} core files -> apps/web/public/tesseract`);

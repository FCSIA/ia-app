// Serve the installed OCR worker and WASM loaders from this app's origin.
// Include the pinned English model: production never needs a third-party CDN.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps", "web", "package.json"));
const workerDirectory = dirname(require.resolve("tesseract.js/package.json"));
const coreDirectory = dirname(require.resolve("tesseract.js-core/package.json"));
const languageDirectory = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const destination = join(root, "apps", "web", "public", "schedule-ocr-assets");

mkdirSync(destination, { recursive: true });
for (const [source, filename] of [
  [workerDirectory, "dist/worker.min.js"],
  [coreDirectory, "tesseract-core-lstm.wasm.js"],
  [coreDirectory, "tesseract-core-simd-lstm.wasm.js"],
  [coreDirectory, "tesseract-core-relaxedsimd-lstm.wasm.js"],
  [languageDirectory, "4.0.0_best_int/eng.traineddata.gz"],
]) {
  copyFileSync(join(source, filename), join(destination, filename.split("/").at(-1)));
}
console.log("Copied local schedule OCR assets to apps/web/public/schedule-ocr-assets");

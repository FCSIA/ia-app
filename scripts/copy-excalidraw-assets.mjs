// Copies Excalidraw's font files into the web app's public folder so the
// whiteboard loads them from this origin; the site CSP only allows same-origin
// fonts, and Excalidraw otherwise falls back to a public CDN. The copy tracks
// the installed package version, so it is generated rather than committed.
import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps", "web", "package.json"));
// The package entry is dist/prod/index.js; its fonts sit beside it.
const source = join(dirname(require.resolve("@excalidraw/excalidraw")), "fonts");
const destination = join(root, "apps", "web", "public", "excalidraw-assets", "fonts");

if (!existsSync(source)) {
  console.error(`Excalidraw fonts not found at ${source}`);
  process.exit(1);
}
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
console.log("Copied Excalidraw fonts to apps/web/public/excalidraw-assets/fonts");

// Optional PDF previews use a matching same-origin worker under the app CSP.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/web/package.json'));
const destination = join(root, 'apps/web/public/pdf-assets');
mkdirSync(destination, { recursive: true });
copyFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), join(destination, 'pdf.worker.min.mjs'));
console.log('Copied same-origin PDF worker');

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const convexEnvPath = join(root, 'apps', 'convex', '.env.local');
const webEnvPath = join(root, 'apps', 'web', '.env.local');

if (!existsSync(convexEnvPath)) {
  console.error('Missing apps/convex/.env.local — run `pnpm --filter cvx dev` and link a project first.');
  process.exit(1);
}

const convexEnv = readFileSync(convexEnvPath, 'utf8');
const read = (key) => {
  const match = convexEnv.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null;
};

const convexUrl = read('CONVEX_URL');
const convexSiteUrl = read('CONVEX_SITE_URL');

if (!convexUrl || !convexSiteUrl) {
  console.error('apps/convex/.env.local must define CONVEX_URL and CONVEX_SITE_URL.');
  process.exit(1);
}

const upsert = (content, key, value) => {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
};

let webEnv = existsSync(webEnvPath) ? readFileSync(webEnvPath, 'utf8') : '';
webEnv = upsert(webEnv, 'NEXT_PUBLIC_CONVEX_URL', convexUrl);
webEnv = upsert(webEnv, 'NEXT_PUBLIC_CONVEX_SITE_URL', convexSiteUrl);
webEnv = upsert(webEnv, 'CONVEX_URL', convexUrl);
webEnv = upsert(webEnv, 'CONVEX_SITE_URL', convexSiteUrl);
if (!/^NEXT_PUBLIC_SITE_URL=/m.test(webEnv)) {
  webEnv = upsert(webEnv, 'NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
}

writeFileSync(webEnvPath, webEnv.endsWith('\n') ? webEnv : `${webEnv}\n`, 'utf8');
console.log(`Synced Convex env to apps/web/.env.local`);
console.log(`  NEXT_PUBLIC_CONVEX_URL=${convexUrl}`);
console.log(`  NEXT_PUBLIC_CONVEX_SITE_URL=${convexSiteUrl}`);

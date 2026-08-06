import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const convexEnvPath = join(root, 'apps', 'convex', '.env.local');
const webEnvPath = join(root, 'apps', 'web', '.env.local');
const mobileEnvPath = join(root, 'apps', 'mobile', '.env.local');
const args = process.argv.slice(2);

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

const deploymentIdentity = (value) => {
  const url = new URL(value);
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
    return 'local';
  }
  return url.hostname.replace(/\.convex\.(cloud|site)$/, '');
};

if (deploymentIdentity(convexUrl) !== deploymentIdentity(convexSiteUrl)) {
  console.error(
    'CONVEX_URL and CONVEX_SITE_URL select different deployments. Fix apps/convex/.env.local before syncing.',
  );
  process.exit(1);
}

const upsert = (content, key, value) => {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
};

const readArgValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const mobileTarget = readArgValue('--target') ?? (args.includes('--android') ? 'android' : undefined);
const mobileHost =
  readArgValue('--host')?.trim() ??
  process.env.MOBILE_CONVEX_HOST?.trim() ??
  (mobileTarget === 'android' ? '10.0.2.2' : undefined);
const mobileUrl = (value) => {
  if (!mobileHost) return value;
  const url = new URL(value);
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
    url.hostname = mobileHost;
  }
  return url.toString().replace(/\/$/, '');
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

let mobileEnv = existsSync(mobileEnvPath) ? readFileSync(mobileEnvPath, 'utf8') : '';
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_APP_SCHEME', 'ia-app');
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_CONVEX_URL', mobileUrl(convexUrl));
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_CONVEX_SITE_URL', mobileUrl(convexSiteUrl));
writeFileSync(mobileEnvPath, mobileEnv.endsWith('\n') ? mobileEnv : `${mobileEnv}\n`, 'utf8');

console.log(`Synced Convex env to apps/web/.env.local`);
console.log(`  NEXT_PUBLIC_CONVEX_URL=${convexUrl}`);
console.log(`  NEXT_PUBLIC_CONVEX_SITE_URL=${convexSiteUrl}`);
console.log(`Synced Convex env to apps/mobile/.env.local`);
console.log(`  EXPO_PUBLIC_CONVEX_URL=${mobileUrl(convexUrl)}`);
console.log(`  EXPO_PUBLIC_CONVEX_SITE_URL=${mobileUrl(convexSiteUrl)}`);
if (!mobileHost && /127\.0\.0\.1|localhost/.test(convexUrl)) {
  console.log('Tip: run `pnpm sync:convex-env -- --android` for Android emulator, or `pnpm sync:convex-env -- --host <your LAN IPv4>` for physical iPhone testing.');
}

if (mobileHost) {
  const nextConvexEnv = upsert(convexEnv, 'MOBILE_CONVEX_HOST', mobileHost);
  writeFileSync(convexEnvPath, nextConvexEnv.endsWith('\n') ? nextConvexEnv : `${nextConvexEnv}\n`, 'utf8');
  console.log(`Saved MOBILE_CONVEX_HOST=${mobileHost} to apps/convex/.env.local for local auth host validation.`);
}

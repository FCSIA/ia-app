import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const convexEnvPath = join(root, 'apps', 'convex', '.env.local');
const webEnvPath = join(root, 'apps', 'web', '.env.local');
const mobileEnvPath = join(root, 'apps', 'mobile', '.env.local');
const args = process.argv.slice(2);

if (!existsSync(convexEnvPath)) {
  console.error('Missing apps/convex/.env.local — run `bun run --filter cvx dev` and link a project first.');
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

const explicitHost = readArgValue('--host')?.trim();
const mobileTarget = readArgValue('--target') ?? (args.includes('--android') ? 'android' : undefined);
const mobileHost =
  explicitHost ??
  (mobileTarget === 'android'
    ? '10.0.2.2'
    : process.env.MOBILE_CONVEX_HOST?.trim() ?? read('MOBILE_CONVEX_HOST') ?? undefined);
const webHost = explicitHost ?? read('WEB_CONVEX_HOST') ?? undefined;
const clientUrl = (value, host) => {
  if (!host) return value;
  const url = new URL(value);
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
    url.hostname = host;
  }
  return url.toString().replace(/\/$/, '');
};

let webEnv = existsSync(webEnvPath) ? readFileSync(webEnvPath, 'utf8') : '';
webEnv = upsert(webEnv, 'NEXT_PUBLIC_CONVEX_URL', clientUrl(convexUrl, webHost));
webEnv = upsert(webEnv, 'NEXT_PUBLIC_CONVEX_SITE_URL', clientUrl(convexSiteUrl, webHost));
webEnv = upsert(webEnv, 'CONVEX_URL', convexUrl);
webEnv = upsert(webEnv, 'CONVEX_SITE_URL', convexSiteUrl);
if (!/^NEXT_PUBLIC_SITE_URL=/m.test(webEnv)) {
  webEnv = upsert(webEnv, 'NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
}

writeFileSync(webEnvPath, webEnv.endsWith('\n') ? webEnv : `${webEnv}\n`, 'utf8');

let mobileEnv = existsSync(mobileEnvPath) ? readFileSync(mobileEnvPath, 'utf8') : '';
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_APP_SCHEME', 'ia-app');
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_CONVEX_URL', clientUrl(convexUrl, mobileHost));
mobileEnv = upsert(mobileEnv, 'EXPO_PUBLIC_CONVEX_SITE_URL', clientUrl(convexSiteUrl, mobileHost));
writeFileSync(mobileEnvPath, mobileEnv.endsWith('\n') ? mobileEnv : `${mobileEnv}\n`, 'utf8');

console.log(`Synced Convex env to apps/web/.env.local`);
console.log(`  NEXT_PUBLIC_CONVEX_URL=${clientUrl(convexUrl, webHost)}`);
console.log(`  NEXT_PUBLIC_CONVEX_SITE_URL=${clientUrl(convexSiteUrl, webHost)}`);
console.log(`Synced Convex env to apps/mobile/.env.local`);
console.log(`  EXPO_PUBLIC_CONVEX_URL=${clientUrl(convexUrl, mobileHost)}`);
console.log(`  EXPO_PUBLIC_CONVEX_SITE_URL=${clientUrl(convexSiteUrl, mobileHost)}`);
if (!mobileHost && !webHost && /127\.0\.0\.1|localhost/.test(convexUrl)) {
  console.log('Tip: run `bun run sync:convex-env -- --android` for Android emulator, or `bun run sync:convex-env -- --host <your LAN IPv4>` for a physical-device client.');
}

if (mobileHost) {
  let nextConvexEnv = upsert(convexEnv, 'MOBILE_CONVEX_HOST', mobileHost);
  if (explicitHost) {
    nextConvexEnv = upsert(nextConvexEnv, 'WEB_CONVEX_HOST', explicitHost);
  }
  writeFileSync(convexEnvPath, nextConvexEnv.endsWith('\n') ? nextConvexEnv : `${nextConvexEnv}\n`, 'utf8');
  console.log(`Saved MOBILE_CONVEX_HOST=${mobileHost} to apps/convex/.env.local for local auth host validation.`);
  if (explicitHost) {
    console.log(`Saved WEB_CONVEX_HOST=${explicitHost} for future web client syncs.`);
  }
}

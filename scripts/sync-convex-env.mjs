import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const convexEnvPath = join(root, 'apps', 'convex', '.env.local');
const webEnvPath = join(root, 'apps', 'web', '.env.local');
const mobileEnvPath = join(root, 'apps', 'mobile', '.env.local');
const args = process.argv.slice(2);
// `pnpm dev` runs this with --heal: it only rewrites the client URLs when a
// saved LAN host is no longer one of this machine's addresses.
const heal = args.includes('--heal');

if (!existsSync(convexEnvPath)) {
  if (heal) process.exit(0);
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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
// Reaches this machine without being one of its addresses.
const ANDROID_EMULATOR_HOST = '10.0.2.2';
const NO_LAN_MESSAGE = [
  'No IPv4 address a phone can reach. iPhone hotspots give the Mac none.',
  'Fix: install Tailscale on the Mac and phone, or share a Wi-Fi network.',
  'Simulators work without either: `pnpm dev`.',
].join('\n');

/** This machine's IPv4 addresses that other devices on its network can reach. */
function lanIPv4Addresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    // Link-local addresses, and 192.0.0.0/29 that macOS uses to translate IPv4
    // on IPv6-only networks, are not reachable from other devices.
    .filter((address) => !address.startsWith('169.254.') && !/^192\.0\.0\.[0-7]$/.test(address));
}

/**
 * The address a phone should use: Tailscale's (100.64.0.0/10) first, since it
 * reaches the phone on any network and goes direct on a shared Wi-Fi, then a
 * shared network's private address.
 */
function preferredLanIPv4() {
  const addresses = lanIPv4Addresses();
  const isPrivate = (address) =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
  const isTailscale = (address) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address);
  return addresses.find(isTailscale) ?? addresses.find(isPrivate) ?? null;
}

const hostOf = (value) => {
  try {
    return value ? new URL(value).hostname : null;
  } catch {
    return null;
  }
};

/** A saved IPv4 host this machine no longer has, e.g. after changing networks. */
const isStaleHost = (host) =>
  !!host &&
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) &&
  !LOOPBACK_HOSTS.has(host) &&
  host !== ANDROID_EMULATOR_HOST &&
  !lanIPv4Addresses().includes(host);

let explicitHost = readArgValue('--host')?.trim();
if (explicitHost === 'auto') {
  explicitHost = preferredLanIPv4();
  if (!explicitHost) {
    console.error(NO_LAN_MESSAGE);
    process.exit(1);
  }
}
if (heal) {
  const readClientEnv = (path, key) => {
    if (!existsSync(path)) return null;
    const match = readFileSync(path, 'utf8').match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? null;
  };
  const savedHosts = [
    read('WEB_CONVEX_HOST'),
    read('MOBILE_CONVEX_HOST'),
    hostOf(readClientEnv(webEnvPath, 'NEXT_PUBLIC_CONVEX_URL')),
    hostOf(readClientEnv(mobileEnvPath, 'EXPO_PUBLIC_CONVEX_URL')),
  ];
  const stale = savedHosts.find(isStaleHost);
  // Cloud deployments have no LAN host to go stale.
  if (deploymentIdentity(convexUrl) !== 'local' || !stale) process.exit(0);
  explicitHost = preferredLanIPv4() ?? '127.0.0.1';
  console.log(
    `Convex clients pointed at ${stale}, which is no longer this machine's address; ` +
      `switching them to ${explicitHost}.`,
  );
  if (explicitHost === '127.0.0.1') console.log(NO_LAN_MESSAGE);
}
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
// Expo CLI reads this from .env.local, so `pnpm dev:mobile` serves the app at
// the same address. Loopback and the emulator alias need no override.
const packagerHost =
  mobileHost && !LOOPBACK_HOSTS.has(mobileHost) && mobileHost !== ANDROID_EMULATOR_HOST
    ? mobileHost
    : null;
mobileEnv = packagerHost
  ? upsert(mobileEnv, 'REACT_NATIVE_PACKAGER_HOSTNAME', packagerHost)
  : mobileEnv.replace(/^REACT_NATIVE_PACKAGER_HOSTNAME=.*\n?/m, '');
writeFileSync(mobileEnvPath, mobileEnv.endsWith('\n') ? mobileEnv : `${mobileEnv}\n`, 'utf8');

console.log(`Synced Convex env to apps/web/.env.local`);
console.log(`  NEXT_PUBLIC_CONVEX_URL=${clientUrl(convexUrl, webHost)}`);
console.log(`  NEXT_PUBLIC_CONVEX_SITE_URL=${clientUrl(convexSiteUrl, webHost)}`);
console.log(`Synced Convex env to apps/mobile/.env.local`);
console.log(`  EXPO_PUBLIC_CONVEX_URL=${clientUrl(convexUrl, mobileHost)}`);
console.log(`  EXPO_PUBLIC_CONVEX_SITE_URL=${clientUrl(convexSiteUrl, mobileHost)}`);
if (packagerHost) console.log(`Phone: open http://${packagerHost}:3000, or run \`pnpm dev:mobile\` and scan the QR code.`);
if (!mobileHost && !webHost && /127\.0\.0\.1|localhost/.test(convexUrl)) {
  console.log('Tip: `pnpm dev:phone` points a physical phone at this machine.');
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

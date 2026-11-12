import { NextResponse } from 'next/server';
import { APP_VERSION } from '@ia/devlog';
import { MIN_CLI_VERSION, type CliDiscoveryDocument } from '~/apps/shared/cli';

/**
 * Served at /.well-known/fcsia-cli.json (see next.config.ts). The command-line
 * client reads it to find this deployment's backend, so `--host` only ever
 * needs the web address people already know. Public and unauthenticated: it
 * holds nothing the web app doesn't already ship to every browser.
 */
export function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (!convexUrl || !convexSiteUrl) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: 'This deployment has no backend configured.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const document: CliDiscoveryDocument = {
    service: 'fcsia',
    convexUrl,
    convexSiteUrl,
    appVersion: APP_VERSION,
    minCliVersion: MIN_CLI_VERSION,
  };
  return NextResponse.json(document, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

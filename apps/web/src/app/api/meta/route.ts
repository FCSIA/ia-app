import { NextResponse } from "next/server";
import {
  APP_VERSION,
  RELEASE_CHANNEL,
  formatVersion,
} from "@ia/devlog";

const build = process.env.NEXT_PUBLIC_APP_COMMIT || null;

/**
 * A deliberately small, unauthenticated deployment marker. It is not linked
 * in the app, but it must remain safe to expose because agents and operators
 * use it to confirm that a release reached a public origin.
 */
export function GET() {
  return NextResponse.json(
    {
      service: "innovation-academy-web",
      version: APP_VERSION,
      channel: RELEASE_CHANNEL,
      release: formatVersion(APP_VERSION, RELEASE_CHANNEL),
      build,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

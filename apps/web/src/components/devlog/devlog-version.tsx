import { APP_VERSION, RELEASE_CHANNEL, formatVersion } from '@ia/devlog';
import { cn } from '@/lib/utils';

/** Short commit of the running build, stamped in by `next.config.ts`. */
export const APP_BUILD = process.env.NEXT_PUBLIC_APP_COMMIT ?? '';

/** `v0.9.0 alpha`, or `v0.9.0 alpha · build 1a2b3c4` when the build is known. */
export function appVersionLabel() {
  const version = formatVersion(APP_VERSION, RELEASE_CHANNEL);
  return APP_BUILD ? `${version} · build ${APP_BUILD}` : version;
}

/**
 * Version stamp for support conversations: it tells a student and a maintainer
 * exactly which build they are looking at.
 */
export function AppVersionStamp({ className }: { className?: string }) {
  return (
    <p className={cn('font-mono text-xs tracking-wide text-muted-foreground', className)}>
      {appVersionLabel()}
    </p>
  );
}

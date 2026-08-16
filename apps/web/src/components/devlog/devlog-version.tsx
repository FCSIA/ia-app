import { appVersionLabel } from './devlog-version-label';
import { cn } from '@/lib/utils';

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

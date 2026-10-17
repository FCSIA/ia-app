'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import {
  RELEASES,
  groupChanges,
  userFacingChanges,
  type Release,
} from '@ia/devlog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

function releaseDate(date: string) {
  // `parseISO` reads a date-only string as local midnight; `new Date` would
  // read it as UTC and show the previous day west of Greenwich.
  return format(parseISO(date), 'MMMM d, yyyy');
}

function ChangeList({ release }: { release: Release }) {
  const groups = groupChanges(userFacingChanges(release));

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This release was maintenance work with no student-facing changes.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ category, changes }) => (
        <section key={category} aria-label={`${category} updates`} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            {category}
          </p>
          <ul className="divide-y divide-border/60">
            {changes.map((change) => (
              <li
                key={[
                  release.version,
                  category,
                  change.commit ?? change.pr ?? change.scope ?? 'general',
                  change.summary,
                ].join(':')}
                className="flex flex-col gap-1 py-3 first:pt-1 last:pb-0 sm:grid sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-x-3"
              >
                {change.scope ? (
                  <span className="break-words pt-0.5 text-xs text-muted-foreground">
                    {change.scope.replaceAll('-', ' ')}
                  </span>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                <p className="break-words text-sm leading-6 text-foreground">{change.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ReleaseHeading({ release }: { release: Release }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="text-sm font-medium tabular-nums text-foreground">v{release.version}</h3>
      <span className="text-xs text-muted-foreground">{releaseDate(release.date)}</span>
    </div>
  );
}

function ReleaseDisclosure({
  release,
  defaultOpen = false,
}: {
  release: Release;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]">
        <div className="min-w-0">
          <ReleaseHeading release={release} />
          {release.title ? (
            <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
              {release.title}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 pb-5 pt-1">
        {release.summary ? (
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">{release.summary}</p>
        ) : null}
        <div className={cn('min-w-0', release.summary && 'mt-5')}>
          <ChangeList release={release} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The devlog: what shipped, newest first.
 *
 * Content comes from `@ia/devlog`, which is regenerated whenever a release is
 * cut, so this list stays current without anyone editing a component.
 */
export function DevlogList({ className }: { className?: string }) {
  if (RELEASES.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No releases have been published yet.
      </p>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col divide-y divide-border/60', className)}>
      {RELEASES.map((release, index) => (
        <ReleaseDisclosure
          key={release.version}
          release={release}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}

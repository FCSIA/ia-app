'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import {
  RELEASES,
  RELEASE_CHANNEL,
  groupChanges,
  userFacingChanges,
  type ChangeCategory,
  type Release,
} from '@ia/devlog';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const CATEGORY_COLOR: Record<ChangeCategory, BadgeColor> = {
  Added: 'green',
  Improved: 'blue',
  Fixed: 'amber',
  Security: 'violet',
  Internal: 'gray',
};

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
    <div className="flex flex-col gap-4">
      {groups.map(({ category, changes }) => (
        <section key={category} aria-label={category}>
          <Badge size="sm" color={CATEGORY_COLOR[category]}>
            {category}
          </Badge>
          <ul className="mt-2 flex flex-col gap-2">
            {changes.map((change, index) => (
              <li
                key={`${change.commit ?? change.summary}-${index}`}
                className="text-sm leading-6 text-foreground"
              >
                {change.scope ? (
                  <span className="text-muted-foreground">{change.scope} — </span>
                ) : null}
                {change.summary}
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
      <h3 className="text-sm font-semibold text-foreground">v{release.version}</h3>
      <span className="text-xs text-muted-foreground">{releaseDate(release.date)}</span>
    </div>
  );
}

function CurrentRelease({ release }: { release: Release }) {
  return (
    <section aria-label={`Version ${release.version}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-foreground">v{release.version}</h3>
        <Badge size="sm" variant="dot" color="blue">
          {RELEASE_CHANNEL}
        </Badge>
        <span className="text-xs text-muted-foreground">{releaseDate(release.date)}</span>
      </div>
      {release.title ? (
        <p className="text-sm font-medium leading-6 text-foreground">{release.title}</p>
      ) : null}
      {release.summary ? (
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">{release.summary}</p>
      ) : null}
      <ChangeList release={release} />
    </section>
  );
}

function EarlierRelease({ release }: { release: Release }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]">
        <div className="min-w-0">
          <ReleaseHeading release={release} />
          {release.title ? (
            <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
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
      <CollapsibleContent className="px-2 pb-4 pt-1">
        {release.summary ? (
          <p className="mb-3 max-w-prose text-sm leading-6 text-muted-foreground">
            {release.summary}
          </p>
        ) : null}
        <ChangeList release={release} />
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
  const [current, ...earlier] = RELEASES;

  if (!current) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No releases have been published yet.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <CurrentRelease release={current} />
      {earlier.length > 0 ? (
        <div className="border-t border-border/60 pt-2">
          <h4 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Earlier releases
          </h4>
          <div className="flex flex-col">
            {earlier.map((release) => (
              <EarlierRelease key={release.version} release={release} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

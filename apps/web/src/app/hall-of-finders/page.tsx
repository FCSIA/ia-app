'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand } from '@/components/layout/page-frame';
import { HallAccess } from '@/components/quest/hall-access';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import styles from '@/components/recognition/plaque-wall.module.css';

const plaqueYearFormatter = new Intl.DateTimeFormat("en", { timeZone: "America/New_York", year: "numeric" });

function FinderPlaques() {
  const currentYear = Number(plaqueYearFormatter.format(Date.now()));
  const [year, setYear] = useState(currentYear);
  const { results, status, loadMore } = usePaginatedQuery(
    api.easterEggs.finders.list,
    { year },
    { initialNumItems: 30 },
  );
  return (
    <section className={styles.wall} aria-label="Completed finder plaques">
      <header className={styles.wallHeader}>
        <h2>Finders · {year}</h2>
        <p>The first 30 students to find all three keys each year earn a permanent place here. Bonus discoverers earn a special mark.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={year <= 2026} onClick={() => setYear((value) => value - 1)}>Previous year</Button>
          <span aria-live="polite">{year}</span>
          <Button variant="secondary" size="sm" disabled={year >= currentYear} onClick={() => setYear((value) => value + 1)}>Next year</Button>
        </div>
      </header>
      {status === 'LoadingFirstPage' ? (
        <p className={styles.wallMessage}>Loading names…</p>
      ) : results.length ? (
        <ol className={styles.plaques}>
          {results.map((finder) => (
            <li key={finder.id} className={styles.plaque} data-yours={finder.isYou} aria-label={finder.isYou ? `${finder.name}, your plaque` : finder.name}>
              <span>{finder.name}</span>
              {finder.bonusComplete ? <Badge size="sm" color="gray" title="Found all bonus secrets">Secret Finder</Badge> : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.wallMessage}>No names have been added yet.</p>
      )}
      {status === 'CanLoadMore' ? (
        <Button className="mt-6" type="button" size="sm" variant="secondary" onClick={() => loadMore(30)}>
          Show more names
        </Button>
      ) : null}
    </section>
  );
}

export default function HallOfFindersPage() {
  return (
    <AppShell>
      <PageFrame className="max-w-5xl">
        <HeroBand
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><Sparkles className="size-4" /> Founders’ Quest</span>}
          title="Hall of Finders"
          description="Names of students who completed the three-key quest."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/hall-of-founders">Visit the Hall of Founders</Link></Button>}
        />
        <HallAccess><FinderPlaques /></HallAccess>
      </PageFrame>
    </AppShell>
  );
}

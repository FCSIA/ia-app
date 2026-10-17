'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand } from '@/components/layout/page-frame';
import { HallAccess } from '@/components/quest/hall-access';
import { Button } from '@/components/ui/button';
import { usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import styles from './finder-wall.module.css';

function FinderPlaques() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.easterEggs.finders.list,
    {},
    { initialNumItems: 30 },
  );
  return (
    <section className={styles.wall} aria-label="Completed finder plaques">
      <header className={styles.wallHeader}>
        <h2>Finders</h2>
        <p>Every name here belongs to someone who found all three keys.</p>
      </header>
      {status === 'LoadingFirstPage' ? (
        <p className={styles.wallMessage}>Loading names…</p>
      ) : results.length ? (
        <ol className={styles.plaques}>
          {results.map((finder) => (
            <li key={finder.id} className={styles.plaque} data-yours={finder.isYou} aria-label={finder.isYou ? `${finder.name}, your plaque` : finder.name}>
              <span>{finder.name}</span>
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
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="size-4" /> Founders’ Quest</span>}
          title="Hall of Finders"
          description="Names of students who completed the three-key quest."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/hall-of-founders">Visit the Hall of Founders</Link></Button>}
        />
        <HallAccess><FinderPlaques /></HallAccess>
      </PageFrame>
    </AppShell>
  );
}

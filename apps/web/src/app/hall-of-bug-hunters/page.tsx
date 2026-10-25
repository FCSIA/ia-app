'use client';

import Link from 'next/link';
import { Bug } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import styles from '@/components/recognition/plaque-wall.module.css';

export default function HallOfBugHuntersPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.moderation.bugRewards.hallOfFame,
    {},
    { initialNumItems: 30 },
  );

  return (
    <AppShell>
      <PageFrame className="max-w-5xl">
        <HeroBand
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Bug className="size-4" /> Community recognition</span>}
          title="Bug Hall of Fame"
          description="Students whose bug reports were confirmed by a developer. Each approved report counts once."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/profile">Back to Profile & Settings</Link></Button>}
        />
        <section className={styles.wall} aria-label="Approved bug reporter plaques">
          <header className={styles.wallHeader}>
            <h2>Bug Hunters</h2>
            <p>Thanks for helping make IA App better for everyone.</p>
          </header>
          {status === 'LoadingFirstPage' ? (
            <p className={styles.wallMessage} role="status">Loading names…</p>
          ) : results.length ? (
            <ol className={styles.plaques}>
              {results.map((member) => (
                <li key={member.id} className={styles.plaque} data-yours={member.isYou}>
                  <span>{member.name}</span>
                  <span className={styles.plaqueCount}>
                    {member.approvedCount} approved {member.approvedCount === 1 ? 'bug' : 'bugs'}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.wallMessage}>No bug reports have been approved yet.</p>
          )}
          {status === 'CanLoadMore' ? (
            <Button className="mt-6" type="button" size="sm" variant="secondary" onClick={() => loadMore(30)}>
              Show more names
            </Button>
          ) : null}
        </section>
      </PageFrame>
    </AppShell>
  );
}

'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Flame, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand, Panel } from '@/components/layout/page-frame';
import { HallAccess } from '@/components/quest/hall-access';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FOUNDERS, FIRST_PROJECT_COMMIT } from '@/lib/founders-quest';
import styles from './founder-deck.module.css';

function FounderDeck() {
  const [selectedIndex, setSelectedIndex] = useState(2);
  const selected = FOUNDERS[selectedIndex];
  const move = (direction: -1 | 1) => setSelectedIndex((index) => (index + direction + FOUNDERS.length) % FOUNDERS.length);

  return (
    <section aria-label="Founder collectible cards" className={styles.exhibit}>
      <div className={styles.intro}>
        <h2>Founder plaques</h2>
        <p>Select a plaque to read that person’s first commit.</p>
      </div>
      <div className={styles.stage}>
        <div className={styles.halo} aria-hidden />
        {FOUNDERS.map((founder, index) => {
          const rawOffset = index - selectedIndex;
          const offset = rawOffset > 2 ? rawOffset - FOUNDERS.length : rawOffset < -2 ? rawOffset + FOUNDERS.length : rawOffset;
          const initials = founder.name.split(' ').map((part) => part[0]).join('');
          return (
            <div
              key={founder.name}
              className={styles.cardPosition}
              data-featured={offset === 0}
              style={{ '--deck-offset': offset, '--deck-depth': 3 - Math.abs(offset) } as CSSProperties}
            >
              <Card
                onClick={() => setSelectedIndex(index)}
                label={`Show ${founder.name}, class of ${founder.classYear}`}
                className={styles.founderCard}
              >
                <div className={styles.cardInner}>
                  <div className={styles.cardTop}><Flame size={20} aria-hidden /></div>
                  <div className={styles.portrait} aria-hidden><span>{initials}</span></div>
                  <div className={styles.cardIdentity}>
                    <span className={styles.classYear}>Class of {founder.classYear}</span>
                    <strong>{founder.name}</strong>
                    <span className={styles.commitSubject}>{founder.firstCommitSubject}</span>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      <div className={styles.deckControls}>
        <Button type="button" size="icon" variant="secondary" aria-label="Previous founder" onClick={() => move(-1)}><ArrowLeft aria-hidden /></Button>
        <p aria-live="polite"><strong>{selected.name}</strong> · {selected.firstCommit.slice(0, 7)}</p>
        <Button type="button" size="icon" variant="secondary" aria-label="Next founder" onClick={() => move(1)}><ArrowRight aria-hidden /></Button>
      </div>
    </section>
  );
}

export default function HallOfFoundersPage() {
  return (
    <AppShell>
      <PageFrame className="max-w-6xl">
        <HeroBand
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="size-4" /> Founders’ Quest</span>}
          title="Hall of Founders"
          description="The people who started the app, and their first recorded contributions."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/hall-of-finders">Visit the Hall of Finders</Link></Button>}
        />
        <HallAccess>
          <FounderDeck />
          <Panel title="The first commit" description="March 2, 2026 — Viraj Das" contentClassName="px-6 pb-6 pt-4">
            <p className="text-sm font-medium">Initial commit <span className="font-mono text-muted-foreground">· {FIRST_PROJECT_COMMIT.slice(0, 7)}</span></p>
          </Panel>
          <Panel title="How the project began" description="The earliest recorded contribution from each founder." contentClassName="px-6 pb-6 pt-4">
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li><span className="font-medium text-foreground">March 2, 2026</span> · Viraj’s initial commit.</li>
              <li><span className="font-medium text-foreground">March 6, 2026</span> · Kirill, Sreyas, Rebanto, and Daivik made their first recorded contributions.</li>
            </ol>
          </Panel>
        </HallAccess>
      </PageFrame>
    </AppShell>
  );
}

'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand, Panel } from '@/components/layout/page-frame';
import { HallAccess } from '@/components/quest/hall-access';
import { Button } from '@/components/ui/button';
import { Card, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/lib/auth';
import { usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';

function FinderPlaques() {
  const user = useCurrentUser();
  const { results, status, loadMore } = usePaginatedQuery(
    api.easterEggs.finders.list,
    {},
    { initialNumItems: 30 },
  );
  const yourName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const others = results.filter((finder) => !finder.isYou);

  return (
    <>
      <Panel title="Your plaque" description="Your name is here because you found all three keys." contentClassName="px-6 pb-6 pt-4">
        <CardGroup border="outlined" separated proximityHover={false}>
          <Card><CardHeader><CardTitle>{yourName}</CardTitle></CardHeader></Card>
        </CardGroup>
      </Panel>
      <section aria-label="Other finder plaques">
        <h2 className="mb-3 text-lg font-semibold">More finders</h2>
        {status === 'LoadingFirstPage' ? (
          <p className="text-sm text-muted-foreground">Loading plaques…</p>
        ) : others.length ? (
          <CardGroup border="outlined" separated proximityHover={false} className="gap-3">
            {others.map((finder) => (
              <Card key={finder.id}><CardHeader><CardTitle>{finder.name}</CardTitle></CardHeader></Card>
            ))}
          </CardGroup>
        ) : (
          <p className="text-sm text-muted-foreground">You’re the first finder shown here.</p>
        )}
        {status === 'CanLoadMore' ? (
          <Button className="mt-4" type="button" size="sm" variant="secondary" onClick={() => loadMore(30)}>
            Show more plaques
          </Button>
        ) : null}
      </section>
    </>
  );
}

export default function HallOfFindersPage() {
  return (
    <AppShell>
      <PageFrame className="max-w-5xl">
        <HeroBand
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="size-4" /> Founders’ Quest</span>}
          title="Hall of Finders"
          description="A name-only plaque for everyone who completed the three-key quest."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/hall-of-founders">Visit the Hall of Founders</Link></Button>}
        />
        <HallAccess><FinderPlaques /></HallAccess>
      </PageFrame>
    </AppShell>
  );
}

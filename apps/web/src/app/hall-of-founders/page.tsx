'use client';

import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame, HeroBand, Panel } from '@/components/layout/page-frame';
import { HallAccess } from '@/components/quest/hall-access';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { FOUNDERS, FIRST_PROJECT_COMMIT, commitUrl } from '@/lib/founders-quest';

export default function HallOfFoundersPage() {
  return (
    <AppShell>
      <PageFrame className="max-w-5xl">
        <HeroBand
          badge={<span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Sparkles className="size-4" /> Founders’ Quest</span>}
          title="Hall of Founders"
          description="Five people, five beginnings. Each plaque links to that founder’s first recorded contribution."
          actions={<Button asChild size="sm" variant="secondary"><Link href="/hall-of-finders">Visit the Hall of Finders</Link></Button>}
        />
        <HallAccess>
          <section aria-label="Founder plaques">
            <CardGroup border="outlined" separated proximityHover={false} className="gap-3">
              {FOUNDERS.map((founder) => (
                <Card key={founder.name}>
                  <CardHeader>
                    <CardTitle>{founder.name}</CardTitle>
                    <CardDescription>Class of {founder.classYear}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button asChild size="sm" variant="ghost">
                      <a href={commitUrl(founder.firstCommit)} target="_blank" rel="noopener noreferrer">
                        Their first commit <ExternalLink aria-hidden />
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </CardGroup>
          </section>
          <Panel title="The first spark" description="March 2, 2026 — the repository’s first recorded commit, by Viraj Das." contentClassName="px-6 pb-6 pt-4">
            <Button asChild size="sm" variant="secondary">
              <a href={commitUrl(FIRST_PROJECT_COMMIT)} target="_blank" rel="noopener noreferrer">
                View the first commit <ExternalLink aria-hidden />
              </a>
            </Button>
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

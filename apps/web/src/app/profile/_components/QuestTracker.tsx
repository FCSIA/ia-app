'use client';

import Link from 'next/link';
import { DoorOpen, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFoundersQuest } from '@/hooks/use-founders-quest';
import { QUEST_CLUES } from '@/lib/founders-quest';
import { SettingsCard } from './ProfileSections';

const KEYS = ['Copper', 'Jade', 'Crystal'] as const;

export function QuestTracker() {
  const { progress, supported } = useFoundersQuest();
  if (!supported || !progress || (!progress.keys.length && !progress.bonusEggs.length)) return null;

  return (
    <div className="mt-5">
      <SettingsCard
        icon={KeyRound}
        title="Founders’ Quest"
        description={progress.complete ? 'Both halls are open.' : `${progress.keys.length} of 3 keys found.`}
      >
        <ol className="grid grid-cols-3 gap-2" aria-label="Quest keys">
          {KEYS.map((key, index) => {
            const found = progress.keys.length > index;
            return (
              <li key={key} className="rounded-xl border border-border/70 px-3 py-3 text-center">
                <KeyRound className={`mx-auto mb-2 size-4 ${found ? 'text-primary' : 'text-muted-foreground/50'}`} aria-hidden />
                <span className={`text-xs font-medium ${found ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {key}{found ? ' ✓' : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">Bonus secrets: {progress.bonusEggs.length} of 3 found. Find all three for a special Hall of Finders marker.</p>
        {progress.complete ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" leadingIcon={DoorOpen}>
              <Link href="/hall-of-finders">Hall of Finders</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" leadingIcon={DoorOpen}>
              <Link href="/hall-of-founders">Hall of Founders</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Next clue: {QUEST_CLUES[progress.keys.length]}
          </p>
        )}
      </SettingsCard>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { KeyRound, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/layout/page-frame';
import { useFoundersQuest } from '@/hooks/use-founders-quest';
import { useCurrentUser } from '@/lib/auth';

export function HallAccess({ children }: { children: ReactNode }) {
  const { progress, supported } = useFoundersQuest();
  const user = useCurrentUser();
  if (supported && (progress?.complete || (user && !user.roles.some((role) => role === 'STUDENT' || role === 'STUDENT_LEADER')))) return <>{children}</>;

  const message = progress === undefined
      ? 'Checking your keys…'
      : `${progress.keys.length} of 3 keys found. Complete the Founders’ Quest to open this hall.`;

  return (
    <Panel title="The hall is locked" description={message} className="max-w-xl" contentClassName="px-6 pb-6 pt-5">
      <div className="flex flex-col items-start gap-4">
        {progress?.keys.length ? <KeyRound className="size-8 text-primary" aria-hidden /> : <LockKeyhole className="size-8 text-muted-foreground" aria-hidden />}
        <Button asChild size="sm" variant="secondary">
          <Link href="/profile">Return to Profile & Settings</Link>
        </Button>
      </div>
    </Panel>
  );
}

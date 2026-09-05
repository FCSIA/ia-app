'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, X } from 'lucide-react';
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useShape } from '@/lib/shape-context';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const DISMISSAL_KEY_PREFIX = 'ia.canvas-calendar-announcement.dismissed.v1';

function dismissalKey(userId: string) {
  return `${DISMISSAL_KEY_PREFIX}.${userId}`;
}

export function CanvasCalendarAnnouncement() {
  const user = useCurrentUser();
  const shape = useShape();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      setDismissed(localStorage.getItem(dismissalKey(user._id)) === 'true');
    } catch {
      setDismissed(false);
    }
  }, [user]);

  if (!user || dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissalKey(user._id), 'true');
    } catch {
      // The announcement remains dismissed for this session if storage is unavailable.
    }
  };

  return (
    <CardGroup orientation="inline" border="outlined" proximityHover={false}>
      <Card className="bg-primary/10">
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center bg-primary/15 text-primary',
            shape.bg
          )}
        >
          <CalendarPlus size={18} strokeWidth={1.5} />
        </span>
        <CardHeader className="py-3">
          <CardEyebrow className="text-primary/70">New</CardEyebrow>
          <CardTitle className="min-w-0 truncate text-primary">Canvas calendar</CardTitle>
          <CardDescription className="truncate text-primary/80">
            Sync assignment due dates straight into your calendar.
          </CardDescription>
        </CardHeader>
        <CardFooter className="pr-2">
          <Button asChild size="icon-sm" aria-label="Connect your Canvas calendar">
            <Link href="/calendar?connect=canvas">
              <ArrowRight />
            </Link>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss Canvas calendar announcement"
            onClick={dismiss}
          >
            <X />
          </Button>
        </CardFooter>
      </Card>
    </CardGroup>
  );
}

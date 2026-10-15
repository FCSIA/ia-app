'use client';

import { BellRing, Moon } from 'lucide-react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import type { IconComponent } from '@/lib/icon-context';
import { api } from '~/apps/convex/src/_generated/api';

type MenuAction = { key: string; icon: IconComponent; label: string; onSelect: () => void };

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * The account menu's Do Not Disturb actions. While it's on, push stops on
 * every device but notifications keep arriving in the inbox.
 */
export function useDoNotDisturbMenu() {
  const isMobile = useIsMobile();
  const status = useQuery(api.presence.status.myStatus);
  const setDoNotDisturb = useMutation(api.presence.status.setDoNotDisturb);
  const clearDoNotDisturb = useMutation(api.presence.status.clearDoNotDisturb);
  const { toast } = useToast();

  const run = (work: Promise<unknown>, message: string) => {
    work
      .then(() => toast({ title: message }))
      .catch((error: unknown) =>
        toast({
          title: error instanceof Error ? error.message : 'Could not change Do not disturb.',
          variant: 'destructive',
        }),
      );
  };
  const turnOn = (minutes: number | null) =>
    run(setDoNotDisturb({ minutes }), 'Do not disturb is on. Notifications still reach your inbox.');

  const actions: MenuAction[] = !status
    ? []
    : status.doNotDisturb
      ? [
          {
            key: 'dnd-off',
            icon: BellRing,
            label: status.until
              ? `Resume notifications (paused until ${timeFormat.format(status.until)})`
              : 'Resume notifications',
            onSelect: () => run(clearDoNotDisturb({}), 'Notifications are back on.'),
          },
        ]
      : [
          { key: 'dnd-1h', icon: Moon, label: 'Do not disturb for 1 hour', onSelect: () => turnOn(60) },
          { key: 'dnd-8h', icon: Moon, label: 'Do not disturb for 8 hours', onSelect: () => turnOn(8 * 60) },
          { key: 'dnd-on', icon: Moon, label: 'Do not disturb until I turn it off', onSelect: () => turnOn(null) },
        ];

  return {
    doNotDisturb: status?.doNotDisturb === true,
    actions: isMobile
      ? actions.filter((action) => action.key === 'dnd-1h' || action.key === 'dnd-off')
      : actions,
  };
}

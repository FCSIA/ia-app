'use client';

import { Bug } from 'lucide-react';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import styles from './bug-hunter-tag.module.css';

type BugReward = { approvedBugCount?: number | null; bugTagColor?: string | null };
const COLORS = new Set<BadgeColor>(['amber', 'blue', 'emerald', 'pink', 'purple', 'red']);

export function BugHunterTag({ user, className }: { user?: BugReward | null; className?: string }) {
  const count = user?.approvedBugCount ?? 0;
  if (count < 1) return null;
  const color = count >= 5 && user?.bugTagColor && COLORS.has(user.bugTagColor as BadgeColor)
    ? user.bugTagColor as BadgeColor : 'amber';
  const title = count >= 50 ? 'Animated Bug Hunter' : count >= 20 ? 'Multicolored Bug Hunter' : count >= 5 ? 'Bug Hunter' : 'Bug Finder';
  return (
    <Badge
      size="sm"
      color={color}
      className={cn(count >= 20 && styles.multicolor, count >= 50 && styles.animated, className)}
      title={`${title}: ${count} developer-approved ${count === 1 ? 'bug' : 'bugs'}`}
    >
      <Bug aria-hidden /> {title}
    </Badge>
  );
}

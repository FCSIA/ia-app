'use client';

import type { CSSProperties } from 'react';
import { useBugTagPreferences, type BugTagPreferences } from './bug-tag-preferences';
import { Bug } from 'lucide-react';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import styles from './bug-hunter-tag.module.css';

type BugReward = { _id?: string; id?: string; approvedBugCount?: number | null; bugTagColor?: string | null };
const COLORS = new Set<BadgeColor>(['amber', 'blue', 'emerald', 'pink', 'purple', 'red']);

export function BugHunterTag({ user, className, preferences: override }: { user?: BugReward | null; className?: string; preferences?: BugTagPreferences }) {
  const { preferences: saved } = useBugTagPreferences(user?._id ?? user?.id);
  const preferences = override ?? saved;
  const count = user?.approvedBugCount ?? 0;
  if (count < 1) return null;
  const color = count >= 5 && user?.bugTagColor && COLORS.has(user.bugTagColor as BadgeColor)
    ? user.bugTagColor as BadgeColor : 'amber';
  const title = count >= 50 ? 'Bug Legend' : count >= 20 ? 'Bug Expert' : count >= 5 ? 'Bug Hunter' : 'Bug Finder';
  return (
    <Badge
      size="sm"
      color={color}
      className={cn(count >= 20 && styles.tag, className)}
      style={count >= 20 ? { backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" } : undefined}
      title={`${title}: ${count} developer-approved ${count === 1 ? 'bug' : 'bugs'}`}
    >
      {count >= 20 ? <span aria-hidden className={cn(styles.paint, count >= 50 && styles[preferences.animation])} style={Object.fromEntries(preferences.colors.map((color, index) => [`--tag-${['first', 'second', 'third'][index]}`, `color-mix(in srgb, ${color} 35%, hsl(var(--card)))`])) as CSSProperties} /> : null}
      <Bug aria-hidden /> {title}
    </Badge>
  );
}

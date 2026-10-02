'use client';

import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Minimal shape any identity object can satisfy. Every backend projection
 * that carries a user (chat authors, club members, announcement authors,
 * profiles) exposes `isDeveloper`, so callers can pass the object straight in.
 */
export type DeveloperFlagged = { isDeveloper?: boolean | null };

type DeveloperBadgeProps = {
  /** The user (or any object carrying `isDeveloper`). Renders nothing unless true. */
  user?: DeveloperFlagged | null;
  /** Icon size in px. Defaults to a small inline glyph that sits beside a name. */
  size?: number;
  className?: string;
};

/**
 * Small wrench badge shown beside a developer's name. Place it directly after
 * the rendered name anywhere a user's identity appears. It is purely
 * presentational: developer status is stored in the database and can only be
 * changed by a super admin via `users.admin.setDeveloper`.
 */
export function DeveloperBadge({ user, size = 14, className }: DeveloperBadgeProps) {
  if (!user?.isDeveloper) return null;
  return (
    <span
      role="img"
      aria-label="Developer"
      title="Developer"
      className={cn(
        'inline-flex shrink-0 items-center justify-center align-middle text-primary',
        className,
      )}
    >
      <Wrench style={{ width: size, height: size }} aria-hidden strokeWidth={2.25} />
    </span>
  );
}

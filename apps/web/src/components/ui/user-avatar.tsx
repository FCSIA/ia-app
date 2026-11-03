'use client';

import type { CSSProperties } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { displayName, nameInitials, type PersonName } from '~/apps/shared/user-name';

/** Anything that names a person. Ids are optional so every data shape fits;
 *  the first stable id found seeds the gradient (see `avatarSeed`). */
export type AvatarPerson = PersonName & {
  _id?: string | null;
  userId?: string | null;
  uniqueId?: string | null;
  avatarUrl?: string | null;
};

export type UserAvatarSize = 20 | 24 | 32 | 40;

const SIZE_CLASS: Record<UserAvatarSize, string> = {
  20: 'size-5',
  24: 'size-6',
  32: 'size-8',
  40: 'size-10',
};

type UserAvatarProps = AvatarPerson & {
  /** Alternative to spreading name fields: pass the person record directly.
   *  Explicit props win over the record's fields. */
  person?: AvatarPerson | null;
  /** Stable identity for the gradient. Defaults to the person's `_id`, then
   *  `userId`, then `uniqueId`, and only then the display name. Pass the same
   *  kind of id everywhere so one person keeps one gradient across the app. */
  seed?: string | null;
  /** Preformatted name, for data that has no first/last fields. */
  name?: string | null;
  /** Rendered diameter in px. `className` may still override it (e.g. size-14);
   *  initials follow the rendered size, not this prop. @default 40 */
  size?: UserAvatarSize;
  className?: string;
  /** Escape hatch for the fallback layer. Avoid restyling the gradient. */
  fallbackClassName?: string;
};

/** 32-bit FNV-1a followed by a murmur3 finalizer, so ids that differ only in
 *  their last characters still land on distant hues. */
function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** The stable seed for a person: their id when the data has one, else name. */
export function avatarSeed(person: AvatarPerson | null | undefined, fallbackName = '') {
  return person?._id || person?.userId || person?.uniqueId || displayName(person) || fallbackName;
}

/** Two hues for a deterministic two-stop gradient (like avatar.vercel.sh, but
 *  local). Lightness and chroma are fixed per theme in the classes below, so
 *  contrast for the initials never depends on the seed. */
export function avatarGradientHues(seed: string) {
  const hash = hashString(seed);
  const from = hash % 360;
  // Second stop is a neighbouring hue (35–94° away) so the blend stays clean
  // and never passes through grey.
  const to = (from + 35 + ((hash >>> 9) % 60)) % 360;
  return { from, to };
}

// Light: soft pastel stops with deep same-hue ink. Dark/high-contrast/palette
// themes (the `dark` variant): deeper stops with near-white ink.
const GRADIENT_CLASS = cn(
  'bg-[linear-gradient(135deg,oklch(0.86_0.09_var(--avatar-from)),oklch(0.74_0.12_var(--avatar-to)))]',
  'text-[oklch(0.3_0.07_var(--avatar-from))]',
  'dark:bg-[linear-gradient(135deg,oklch(0.5_0.11_var(--avatar-from)),oklch(0.38_0.1_var(--avatar-to)))]',
  'dark:text-[oklch(0.97_0.02_var(--avatar-from))]',
);

/**
 * The one person avatar. Photo when there is one; otherwise (and when the photo
 * fails to load) a gradient derived from the person's stable id. Initials appear
 * only when the avatar renders at 32px or larger.
 */
export function UserAvatar({
  person,
  seed,
  name,
  size = 40,
  className,
  fallbackClassName,
  ...fields
}: UserAvatarProps) {
  const merged: AvatarPerson = {
    ...person,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  };
  const label = displayName(merged) || name || '';
  const initials = (nameInitials(merged) || nameInitials({ preferredName: label })).toUpperCase();
  const { from, to } = avatarGradientHues(seed || avatarSeed(merged, label));

  return (
    <Avatar
      // The container query lets initials follow the rendered size, so a
      // className size override still gets the right treatment.
      className={cn('@container', SIZE_CLASS[size], className)}
      style={{ '--avatar-from': from, '--avatar-to': to } as CSSProperties}
    >
      {merged.avatarUrl ? <AvatarImage src={merged.avatarUrl} alt={label} className="object-cover" /> : null}
      <AvatarFallback className={cn(GRADIENT_CLASS, 'select-none', fallbackClassName)}>
        <span
          aria-hidden
          className="hidden font-medium leading-none tracking-tight text-[length:max(11px,34cqi)] @min-[32px]:inline"
        >
          {initials}
        </span>
      </AvatarFallback>
    </Avatar>
  );
}

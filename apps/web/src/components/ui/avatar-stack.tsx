"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { displayName, type PersonName } from "~/apps/shared/user-name";

type StackPerson = PersonName & {
  _id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
};

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
} as const;

const AVATAR_SIZE = { sm: 24, md: 32 } as const;

/** Overlapping avatars with a "+N" overflow chip; names are in the tooltip. */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: StackPerson[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const hidden = people.length - shown.length;
  const names = people.map((person) => displayName(person)).join(", ");
  return (
    <Tooltip content={names}>
      <span
        role="img"
        aria-label={names}
        className={cn("flex shrink-0 items-center -space-x-1.5", className)}
      >
        {shown.map((person) => (
          <UserAvatar
            key={person._id}
            person={person}
            size={AVATAR_SIZE[size]}
            className="ring-2 ring-card"
          />
        ))}
        {hidden > 0 ? (
          <span
            className={cn(
              SIZES[size],
              "flex items-center justify-center rounded-full bg-muted font-medium tabular-nums text-muted-foreground ring-2 ring-card",
            )}
          >
            +{hidden}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

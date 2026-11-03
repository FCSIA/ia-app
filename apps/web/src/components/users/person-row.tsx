"use client";

import { PresenceAvatar, useMemberPresence } from "@/components/presence/club-presence";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PersonTrigger } from "@/components/users/person-trigger";
import type { UserProfilePerson } from "@/components/users/user-profile-avatar";
import { displayName } from "~/apps/shared/user-name";

/** A person reference with avatar, presence, and profile preview. */
export function PersonRow({ person, roleName, showRole = false, index }: {
  person: UserProfilePerson;
  roleName?: string;
  /** Print the role at the row's end, for mixed rosters without role headings. */
  showRole?: boolean;
  index?: number;
}) {
  const presence = useMemberPresence(person._id);
  const name = displayName(person);
  return (
    <Card index={index} className="min-h-8 pl-0">
      <PersonTrigger person={person} roleName={roleName} trigger={
      <button type="button" className="flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-[inherit] px-1.5 text-left text-[13px] text-muted-foreground outline-none hover:text-foreground active:bg-active focus-visible:text-foreground data-[state=open]:text-foreground [-webkit-tap-highlight-color:transparent] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`View ${name}${showRole && roleName ? `, ${roleName}` : ""} profile`}>
        <PresenceAvatar status={presence}><UserAvatar person={person} size={24} /></PresenceAvatar>
        <span className="truncate">{name}</span>
        {showRole && roleName ? <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{roleName}</span> : null}
      </button>
      } />
    </Card>
  );
}

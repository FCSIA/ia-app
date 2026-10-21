import { nameSearchValues } from '~/apps/shared/user-name';
import type { ClubDirectoryEntry } from "@/components/clubs/types";

export function peopleSearchValues(person: ClubDirectoryEntry) {
  return [
    ...nameSearchValues(person),
    person.uniqueId,
    person.kind,
    person.clubRole,
    person.customRoleName,
    person.roleName,
    ...person.unitNames,
  ];
}

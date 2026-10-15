import type { ClubDirectoryEntry } from "@/components/clubs/types";

export function peopleSearchValues(person: ClubDirectoryEntry) {
  return [
    `${person.firstName} ${person.lastName}`.trim(),
    person.uniqueId,
    person.kind,
    person.clubRole,
    person.customRoleName,
    person.roleName,
    ...person.unitNames,
  ];
}

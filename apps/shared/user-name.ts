/** Profile names shared by the backend, web, and native clients. */
export type PersonName = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
};

export const MAX_PREFERRED_NAME_LENGTH = 80;

export function regularName(person: PersonName | null | undefined): string {
  return [person?.firstName?.trim(), person?.lastName?.trim()].filter(Boolean).join(" ");
}

export function displayName(person: PersonName | null | undefined): string {
  return person?.preferredName?.trim() || regularName(person);
}

export function greetingName(person: PersonName | null | undefined): string {
  return person?.preferredName?.trim() || person?.firstName?.trim() || "";
}

export function nameInitials(person: PersonName | null | undefined): string {
  const parts = displayName(person).split(/\s+/).filter(Boolean);
  return (Array.from(parts[0] ?? "")[0] ?? "") + (parts.length > 1 ? Array.from(parts.at(-1)!)[0] : "");
}

export function nameSearchValues(person: PersonName | null | undefined): string[] {
  return [regularName(person), person?.preferredName?.trim() ?? ""];
}

export const MAX_CLUB_UNITS = 250;
export const MAX_CLUB_UNIT_DEPTH = 12;
export const MAX_CLUB_UNIT_NAME_LENGTH = 80;
export const MAX_CLUB_UNIT_KIND_LENGTH = 40;
export const MAX_CLUB_UNIT_DESCRIPTION_LENGTH = 280;
export const MAX_CLUB_UNIT_TITLE_LENGTH = 60;

export function normalizeRequiredLabel(value: string, label: string, max: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer`);
  }
  return normalized;
}

export function normalizeOptionalLabel(value: string | undefined, max: number) {
  const normalized = value?.trim().replace(/\s+/g, " ") || undefined;
  if (normalized && normalized.length > max) {
    throw new Error(`Value must be ${max} characters or fewer`);
  }
  return normalized;
}

export function assertDistinctSiblingName(
  siblingNames: string[],
  candidateName: string,
) {
  const normalized = candidateName.trim().toLocaleLowerCase();
  if (
    siblingNames.some((name) => name.trim().toLocaleLowerCase() === normalized)
  ) {
    throw new Error("A unit with this name already exists at this level");
  }
}

export function assertHierarchyDepth(depth: number) {
  if (depth > MAX_CLUB_UNIT_DEPTH) {
    throw new Error(
      `Club hierarchies support up to ${MAX_CLUB_UNIT_DEPTH} nested levels`,
    );
  }
}

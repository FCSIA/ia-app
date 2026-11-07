export const MAX_CLUB_UNITS = 250;
export const MAX_CLUB_UNIT_DEPTH = 12;
export const MAX_CLUB_UNIT_NAME_LENGTH = 80;
export const MAX_CLUB_UNIT_KIND_LENGTH = 40;
export const MAX_CLUB_UNIT_DESCRIPTION_LENGTH = 280;

export function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeRequiredLabel(value: string, label: string, max: number) {
  const normalized = normalizeLabel(value);
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer`);
  }
  return normalized;
}

export function normalizeOptionalLabel(value: string | undefined, max: number) {
  const normalized = (value && normalizeLabel(value)) || undefined;
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

export function childUnitIdsByParent<T extends string>(
  units: ReadonlyArray<{ _id: T; parentUnitId?: T | null }>,
) {
  const children = new Map<T, T[]>();
  for (const unit of units) {
    if (!unit.parentUnitId) continue;
    const siblings = children.get(unit.parentUnitId) ?? [];
    siblings.push(unit._id);
    children.set(unit.parentUnitId, siblings);
  }
  return children;
}

/**
 * `rootId` and every unit beneath it, breadth first. Each unit is visited
 * once, so corrupt data with a parent cycle ends instead of looping.
 */
export function unitAndDescendantIds<T extends string>(
  rootId: T,
  childrenByParent: ReadonlyMap<T, readonly T[]>,
) {
  const ids = [rootId];
  const seen = new Set<T>(ids);
  for (let index = 0; index < ids.length; index += 1) {
    for (const childId of childrenByParent.get(ids[index]) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      ids.push(childId);
    }
  }
  return ids;
}

/** An assignment at the target or any ancestor grants downward access. */
export function assignmentCoversUnit<T extends string>(
  assignedUnitId: T,
  targetUnitId: T,
  parentByUnitId: ReadonlyMap<T, T | null>,
) {
  let current: T | null = targetUnitId;
  const visited = new Set<T>();
  while (current) {
    if (current === assignedUnitId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentByUnitId.get(current) ?? null;
  }
  return false;
}

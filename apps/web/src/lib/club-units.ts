import type { Id } from '~/apps/convex/src/_generated/dataModel';

type UnitId = Id<'clubUnits'>;
type UnitNode = { _id: UnitId; parentUnitId: UnitId | null };

export function childrenByParent<T extends UnitNode>(units: readonly T[]) {
  const children = new Map<UnitId | null, T[]>();
  for (const unit of units) {
    const parentId = unit.parentUnitId ?? null;
    const siblings = children.get(parentId);
    if (siblings) siblings.push(unit);
    else children.set(parentId, [unit]);
  }
  return children;
}

/** Siblings sit in the club's chosen order, then by name. */
export function sortSiblings<T extends { position: number; name: string }>(units: readonly T[]) {
  return [...units].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/** The unit and everything beneath it. */
export function descendantIds<T extends UnitNode>(units: readonly T[], rootId: UnitId) {
  const children = childrenByParent(units);
  const collected = new Set<UnitId>([rootId]);
  const stack: UnitId[] = [rootId];
  while (stack.length) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (!collected.has(child._id)) {
        collected.add(child._id);
        stack.push(child._id);
      }
    }
  }
  return collected;
}

/** The unit and each parent above it, nearest first. */
export function ancestorIds<T extends UnitNode>(units: readonly T[], unitId: UnitId) {
  const parentById = new Map(units.map((unit) => [unit._id, unit.parentUnitId]));
  const chain: UnitId[] = [];
  let current: UnitId | null | undefined = unitId;
  while (current) {
    chain.push(current);
    current = parentById.get(current);
  }
  return chain;
}

/** Units in tree order (parents before their sorted children) with their depth. */
export function flattenUnits<T extends UnitNode & { position: number; name: string }>(units: readonly T[]) {
  const children = childrenByParent(units);
  const rows: Array<{ unit: T; depth: number }> = [];
  const visit = (parentId: UnitId | null, depth: number) => {
    for (const unit of sortSiblings(children.get(parentId) ?? [])) {
      rows.push({ unit, depth });
      visit(unit._id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

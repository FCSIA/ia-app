type UnitShape = { _id: string; parentUnitId: string | null; position: number };
type ChannelShape = { _id: string; ownerUnitId?: string | null };

export type NotificationChannelNode<Unit, Channel> =
  | { kind: 'unit'; unit: Unit; children: NotificationChannelNode<Unit, Channel>[] }
  | { kind: 'channel'; channel: Channel };

/** Preserve workspace placement, omitting branches with no readable channels. */
export function buildNotificationChannelTree<Unit extends UnitShape, Channel extends ChannelShape>(
  units: readonly Unit[],
  channels: readonly Channel[],
): NotificationChannelNode<Unit, Channel>[] {
  const unitIds = new Set(units.map((unit) => unit._id));
  const visited = new Set<string>();
  const orderedUnits = [...units].sort((a, b) => a.position - b.position);
  const channelsByOwner = new Map<string | null, NotificationChannelNode<Unit, Channel>[]>();
  for (const channel of channels) {
    const ownerId = channel.ownerUnitId && unitIds.has(channel.ownerUnitId)
      ? channel.ownerUnitId : null;
    const siblings = channelsByOwner.get(ownerId) ?? [];
    siblings.push({ kind: 'channel', channel });
    channelsByOwner.set(ownerId, siblings);
  }
  const unitsByParent = new Map<string | null, Unit[]>();
  for (const unit of orderedUnits) {
    const parentId = unit.parentUnitId && unitIds.has(unit.parentUnitId)
      ? unit.parentUnitId : null;
    const siblings = unitsByParent.get(parentId) ?? [];
    siblings.push(unit);
    unitsByParent.set(parentId, siblings);
  }

  const branch = (unit: Unit): NotificationChannelNode<Unit, Channel>[] => {
    if (visited.has(unit._id)) return [];
    visited.add(unit._id);
    const children = [...(channelsByOwner.get(unit._id) ?? [])];
    for (const child of unitsByParent.get(unit._id) ?? []) children.push(...branch(child));
    return children.length ? [{ kind: 'unit', unit, children }] : [];
  };

  const tree = [...(channelsByOwner.get(null) ?? [])];
  for (const root of unitsByParent.get(null) ?? []) tree.push(...branch(root));
  // Do not lose readable channels if a stale parent link forms a cycle.
  for (const unit of orderedUnits) tree.push(...branch(unit));
  return tree;
}

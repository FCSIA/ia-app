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
  const channelNodes = (ownerId: string | null): NotificationChannelNode<Unit, Channel>[] =>
    channels
      .filter((channel) => ownerId === null
        ? !channel.ownerUnitId || !unitIds.has(channel.ownerUnitId)
        : channel.ownerUnitId === ownerId)
      .map((channel) => ({ kind: 'channel', channel }));

  const branch = (unit: Unit): NotificationChannelNode<Unit, Channel>[] => {
    if (visited.has(unit._id)) return [];
    visited.add(unit._id);
    const children = [
      ...channelNodes(unit._id),
      ...orderedUnits.filter((child) => child.parentUnitId === unit._id).flatMap(branch),
    ];
    return children.length ? [{ kind: 'unit', unit, children }] : [];
  };

  const roots = orderedUnits.filter((unit) => !unit.parentUnitId || !unitIds.has(unit.parentUnitId));
  const tree = [...channelNodes(null), ...roots.flatMap(branch)];
  // Do not lose readable channels if a stale parent link forms a cycle.
  for (const unit of orderedUnits) tree.push(...branch(unit));
  return tree;
}

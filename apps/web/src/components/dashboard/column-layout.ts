/** Dashboard product layout; dnd-kit owns drag gestures and sortable previews. */
export type DashboardArrangement = { layout: string[]; columns: string[][] };

const GAP = 24;
const ESTIMATED_HEIGHT = 320;

export function columnHeight(
  ids: readonly string[],
  heights: Record<string, number>,
): number {
  return (
    ids.reduce((sum, id) => sum + (heights[id] ?? ESTIMATED_HEIGHT), 0) +
    Math.max(0, ids.length - 1) * GAP
  );
}

/** Minimize page length, preferring the fewest moves when solutions tie. */
export function balanceColumns(
  columns: string[][],
  order: string[],
  heights: Record<string, number>,
): string[][] {
  const movable = new Set(columns.flat());
  const membership = columns.map((column) => new Set(column));
  const ids = order.filter((id) => movable.has(id));
  let best = columns;
  let bestHeight = Math.max(
    ...columns.map((column) => columnHeight(column, heights)),
  );
  let fewestMoves = 0;
  // The registry has ten movable widgets, so at most 1,024 candidates.
  for (let mask = 0; mask < 2 ** ids.length; mask += 1) {
    const candidate: string[][] = [[], []];
    let moves = 0;
    ids.forEach((id, index) => {
      const target = (mask >> index) & 1;
      candidate[target].push(id);
      if (!membership[target].has(id)) moves += 1;
    });
    const height = Math.max(
      ...candidate.map((column) => columnHeight(column, heights)),
    );
    if (height < bestHeight || (height === bestHeight && moves < fewestMoves)) {
      best = candidate;
      bestHeight = height;
      fewestMoves = moves;
    }
  }
  return best;
}

export function canImproveBalance(
  columns: string[][],
  balanced: string[][],
  heights: Record<string, number>,
): boolean {
  const current = Math.max(
    ...columns.map((column) => columnHeight(column, heights)),
  );
  const next = Math.max(
    ...balanced.map((column) => columnHeight(column, heights)),
  );
  // Avoid inviting a rearrangement for a few pixels of incidental content.
  return current - next >= Math.max(GAP, current * 0.05);
}

/** Interleave desktop columns into a useful mobile reading order. */
export function withColumns(
  state: DashboardArrangement,
  columns: string[][],
): DashboardArrangement {
  const movable = new Set(columns.flat());
  const layout = state.layout.filter((id) => !movable.has(id));
  for (
    let row = 0;
    row < Math.max(...columns.map((column) => column.length));
    row += 1
  ) {
    for (const column of columns) if (column[row]) layout.push(column[row]);
  }
  return { layout, columns };
}

export function moveToColumn(
  state: DashboardArrangement,
  id: string,
  target: number,
  index: number,
): DashboardArrangement {
  const columns = state.columns.map((column) =>
    column.filter((item) => item !== id),
  );
  columns[target].splice(index, 0, id);
  return withColumns(state, columns);
}

/** A mobile reorder changes order within columns, without losing membership. */
export function withMobileOrder(
  state: DashboardArrangement,
  layout: string[],
): DashboardArrangement {
  return {
    layout,
    columns: state.columns.map((column) =>
      layout.filter((id) => column.includes(id)),
    ),
  };
}

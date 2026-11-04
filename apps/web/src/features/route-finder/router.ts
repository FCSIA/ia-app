// Shortest-walk router for the Route Finder, ported from IA Nexus
// (jackiedv2011/ia-nexus-school-navigation, backend/data/roomCoordinates.js).
//
// Each floor's hallways become a graph: every corridor intersection is a node,
// and every doorway and stair landing is projected perpendicularly onto its
// nearest corridor and joined by a short right-angle stub. Dijkstra runs over
// that graph; a cross-floor trip tries every stairwell with a landing on both
// floors and keeps the cheapest. It is pure computation over static data, so it
// runs entirely in the browser.

import {
  CORRIDORS,
  FLOORS,
  ROOM_DOORS,
  ROOM_LABELS,
  STAIR_POSITIONS,
  UPPER_FLOOR_ONLY_STAIRS,
  type Floor,
  type HorizontalCorridor,
  type Point,
  type VerticalCorridor,
} from "./building-data";

type Corridor = HorizontalCorridor | VerticalCorridor;
type Foot = { x: number; y: number; corr: Corridor; axis: "h" | "v" };
type GraphNode = { id: string; x: number; y: number };
type Edge = { to: string; dist: number };
type Graph = {
  nodes: Record<string, GraphNode>;
  edges: Record<string, Edge[]>;
  // Present on a per-query overlay: the adjacency lists it has cloned.
  owned?: Set<string>;
};

export type RoomEndpoint = { kind: "room"; room: string; floor: Floor };
export type PointEndpoint = { kind: "point"; x: number; y: number; floor: Floor };
export type Endpoint = RoomEndpoint | PointEndpoint;

export type RouteResult = {
  error?: string;
  sameFloor: boolean;
  fromFloor: Floor;
  toFloor: Floor;
  fromLabel: string;
  toLabel: string;
  path1: Point[];
  path2: Point[] | null;
  stairNum: number | null;
  stairFromPos: Point | null;
  stairToPos: Point | null;
  meters?: number;
  minutes?: number;
};

// Corridor extents come from a hand drawing, so a junction can be recorded a
// few pixels short of touching. Junctions within this distance are snapped.
const JUNCTION_TOL = 30;

// An unclamped (straight-across) foot is preferred over one clamped past a
// corridor's end, unless the clamped one is dramatically closer.
const CLAMP_PENALTY = 60;

const isHorizontal = (corr: Corridor): corr is HorizontalCorridor => "xMin" in corr;

export function projectOntoNearestCorridor(
  [px, py]: Point,
  floor: Floor,
  { walkableOnly = false } = {},
): Foot | null {
  const corrs = CORRIDORS[floor];
  if (!corrs) return null;
  const usable = walkableOnly ? walkableCorridors(floor) : null;
  let best: Foot | null = null;
  let bestScore = Infinity;
  const consider = (cand: Foot, clamped: boolean, d: number) => {
    if (usable && !usable.has(cand.corr)) return;
    const score = d + (clamped ? CLAMP_PENALTY : 0);
    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  };
  for (const hc of corrs.horizontal) {
    const fx = Math.min(Math.max(px, hc.xMin), hc.xMax);
    consider({ x: fx, y: hc.y, corr: hc, axis: "h" }, fx !== px, Math.hypot(fx - px, hc.y - py));
  }
  for (const vc of corrs.vertical) {
    const fy = Math.min(Math.max(py, vc.yMin), vc.yMax);
    consider({ x: vc.x, y: fy, corr: vc, axis: "v" }, fy !== py, Math.hypot(vc.x - px, fy - py));
  }
  return best;
}

// The corridors in the largest connected piece of a floor's hallway network.
// A dropped pin attaches only to these, so it never lands on an isolated stub
// (floor 2 has one near the BioTech Lab). Doorways and stairwells still use the
// unfiltered projection because their positions come from the plans.
const WALKABLE: Partial<Record<Floor, Set<Corridor>>> = {};
function walkableCorridors(floor: Floor): Set<Corridor> {
  const cached = WALKABLE[floor];
  if (cached) return cached;
  const { nodes, edges } = getGraph(floor);
  const corrs = CORRIDORS[floor];

  const seen = new Set<string>();
  const componentOf = new Map<string, string>();
  let biggest: string | null = null;
  let biggestSize = -1;
  for (const start of Object.keys(nodes)) {
    if (seen.has(start)) continue;
    const stack = [start];
    const members: string[] = [];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop()!;
      members.push(u);
      for (const e of edges[u] ?? []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        stack.push(e.to);
      }
    }
    for (const m of members) componentOf.set(m, start);
    if (members.length > biggestSize) {
      biggestSize = members.length;
      biggest = start;
    }
  }

  const set = new Set<Corridor>();
  const inMain = (x: number, y: number) => componentOf.get(`${x},${y}`) === biggest;
  for (const hc of corrs.horizontal) {
    if (inMain(hc.xMin, hc.y) || inMain(hc.xMax, hc.y)) set.add(hc);
  }
  for (const vc of corrs.vertical) {
    if (inMain(vc.x, vc.yMin) || inMain(vc.x, vc.yMax)) set.add(vc);
  }
  WALKABLE[floor] = set;
  return set;
}

function buildFloorGraph(floor: Floor): Graph {
  const corrs = CORRIDORS[floor];
  const nodes: Record<string, GraphNode> = {};
  const edges: Record<string, Edge[]> = {};

  const nodeId = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!nodes[key]) {
      nodes[key] = { id: key, x, y };
      edges[key] = [];
    }
    return key;
  };

  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    const na = nodes[a];
    const nb = nodes[b];
    const dist = Math.hypot(nb.x - na.x, nb.y - na.y);
    if (!edges[a].some((e) => e.to === b)) edges[a].push({ to: b, dist });
    if (!edges[b].some((e) => e.to === a)) edges[b].push({ to: a, dist });
  };

  // Every doorway and stair landing on this floor meets the hallways at the
  // foot of its perpendicular onto the nearest corridor.
  const attachPoints: Point[] = [];
  for (const [key, doors] of Object.entries(ROOM_DOORS)) {
    if (parseInt(key.split(":")[0], 10) !== floor) continue;
    attachPoints.push(...doors);
  }
  for (const landings of Object.values(STAIR_POSITIONS)) {
    const landing = landings[floor];
    if (landing) attachPoints.push(landing);
  }
  const attachments = attachPoints.map((pt) => ({
    pt,
    foot: projectOntoNearestCorridor(pt, floor)!,
  }));

  // Horizontal corridors: gather every point on one, sort by x, and chain them.
  for (const hc of corrs.horizontal) {
    const pts = new Map<number, number>();
    pts.set(hc.xMin, hc.y);
    pts.set(hc.xMax, hc.y);
    for (const vc of corrs.vertical) {
      if (
        vc.x >= hc.xMin - JUNCTION_TOL && vc.x <= hc.xMax + JUNCTION_TOL &&
        hc.y >= vc.yMin - JUNCTION_TOL && hc.y <= vc.yMax + JUNCTION_TOL
      ) {
        pts.set(vc.x, hc.y);
      }
    }
    for (const a of attachments) {
      if (a.foot.axis === "h" && a.foot.corr === hc) pts.set(a.foot.x, hc.y);
    }
    const sorted = Array.from(pts.entries()).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      addEdge(nodeId(sorted[i][0], sorted[i][1]), nodeId(sorted[i + 1][0], sorted[i + 1][1]));
    }
  }

  // Vertical corridors: same, sorted by y. Junction nodes match the ones the
  // horizontal pass created, so crossing corridors share a node.
  for (const vc of corrs.vertical) {
    const pts = new Map<number, number>();
    pts.set(vc.yMin, vc.x);
    pts.set(vc.yMax, vc.x);
    for (const hc of corrs.horizontal) {
      if (
        hc.y >= vc.yMin - JUNCTION_TOL && hc.y <= vc.yMax + JUNCTION_TOL &&
        vc.x >= hc.xMin - JUNCTION_TOL && vc.x <= hc.xMax + JUNCTION_TOL
      ) {
        pts.set(hc.y, vc.x);
      }
    }
    for (const a of attachments) {
      if (a.foot.axis === "v" && a.foot.corr === vc) pts.set(a.foot.y, vc.x);
    }
    const sorted = Array.from(pts.entries()).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      addEdge(nodeId(sorted[i][1], sorted[i][0]), nodeId(sorted[i + 1][1], sorted[i + 1][0]));
    }
  }

  // Join each doorway or landing to its foot; an elbow keeps the walk at right
  // angles when the foot had to be clamped to a corridor's end.
  for (const { pt, foot } of attachments) {
    const pKey = nodeId(pt[0], pt[1]);
    const fKey = nodeId(foot.x, foot.y);
    if (pt[0] === foot.x || pt[1] === foot.y) {
      addEdge(pKey, fKey);
    } else {
      const elbow = foot.axis === "h" ? nodeId(pt[0], foot.y) : nodeId(foot.x, pt[1]);
      addEdge(pKey, elbow);
      addEdge(elbow, fKey);
    }
  }

  return { nodes, edges };
}

const GRAPHS: Partial<Record<Floor, Graph>> = {};
function getGraph(floor: Floor): Graph {
  return (GRAPHS[floor] ??= buildFloorGraph(floor));
}

function dijkstra(graph: Graph, startKey: string, endKey: string) {
  const { nodes, edges } = graph;
  if (!nodes[startKey] || !nodes[endKey]) return null;

  const dist: Record<string, number> = {};
  const prev: Record<string, string> = {};
  const visited = new Set<string>();
  for (const k of Object.keys(nodes)) dist[k] = Infinity;
  dist[startKey] = 0;

  const queue = [startKey];
  while (queue.length > 0) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    if (curr === endKey) break;

    for (const { to, dist: d } of edges[curr] ?? []) {
      if (visited.has(to)) continue;
      const newDist = dist[curr] + d;
      if (newDist < (dist[to] ?? Infinity)) {
        dist[to] = newDist;
        prev[to] = curr;
        if (!queue.includes(to)) queue.push(to);
      }
    }
  }

  if (dist[endKey] === Infinity) return null;

  const path: Point[] = [];
  let curr: string | undefined = endKey;
  while (curr !== undefined) {
    const n: GraphNode = nodes[curr];
    path.unshift([n.x, n.y]);
    curr = prev[curr];
  }
  return { path, cost: dist[endKey] };
}

function getRoomKey(roomStr: string, floor: Floor) {
  return `${floor}:${String(roomStr).toLowerCase().replace(/\s+/g, "")}`;
}

// Rooms sharing one doorway are listed under a combined key ("3:392/394"); map
// each half onto it so asking for "392" works. An explicit entry always wins.
const PAIR_ALIASES: Record<string, string> = {};
for (const key of Object.keys(ROOM_DOORS)) {
  const [floor, name] = key.split(":");
  if (!name.includes("/")) continue;
  for (const half of name.split("/")) {
    const alias = `${floor}:${half.trim()}`;
    if (!ROOM_DOORS[alias]) PAIR_ALIASES[alias] = key;
  }
}

function canonicalRoomKey(roomStr: string, floor: Floor): string | null {
  const key = getRoomKey(roomStr, floor);
  if (ROOM_DOORS[key]) return key;
  return PAIR_ALIASES[key] ?? null;
}

function getRoomDoors(roomStr: string, floor: Floor) {
  const key = canonicalRoomKey(roomStr, floor);
  return key ? ROOM_DOORS[key] : null;
}

// A per-query working copy of a shared floor graph. Node and edge maps are new
// objects; an adjacency list is cloned only when this query first writes to it,
// so the cached base graph is never mutated.
function overlayGraph(base: Graph): Graph {
  return { nodes: { ...base.nodes }, edges: { ...base.edges }, owned: new Set() };
}

function edgesFor(graph: Graph, key: string): Edge[] {
  if (!graph.owned) {
    return (graph.edges[key] ??= []);
  }
  if (!graph.owned.has(key)) {
    graph.edges[key] = (graph.edges[key] ?? []).slice();
    graph.owned.add(key);
  }
  return graph.edges[key];
}

// Attaches a point the network doesn't already carry to its nearest node.
function ensurePointInGraph(graph: Graph, [x, y]: Point) {
  const nodeKey = `${x},${y}`;
  if (graph.nodes[nodeKey]) return nodeKey;

  graph.nodes[nodeKey] = { id: nodeKey, x, y };

  let best: string | null = null;
  let bestDist = Infinity;
  for (const [k, n] of Object.entries(graph.nodes)) {
    if (k === nodeKey) continue;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  if (best) {
    edgesFor(graph, nodeKey).push({ to: best, dist: bestDist });
    edgesFor(graph, best).push({ to: nodeKey, dist: bestDist });
  } else {
    edgesFor(graph, nodeKey);
  }
  return nodeKey;
}

// A room with several doorways gets a zero-cost terminal joined to each door,
// so one Dijkstra run picks the cheapest door. The terminal is one-way ('out'
// for the start, 'in' for the destination) so no other route can walk in one
// door of the room and out another for free.
function addRoomTerminal(graph: Graph, roomStr: string, floor: Floor, dir: "in" | "out") {
  const doors = getRoomDoors(roomStr, floor);
  if (!doors || doors.length === 0) return null;

  const termKey = `room:${dir}:${canonicalRoomKey(roomStr, floor)}`;
  const doorKeys = doors.map((d) => ensurePointInGraph(graph, d));

  if (!graph.nodes[termKey]) {
    graph.nodes[termKey] = { id: termKey, x: doors[0][0], y: doors[0][1] };
  }
  const termEdges = edgesFor(graph, termKey);
  for (const dk of doorKeys) {
    if (dir === "out") {
      if (!termEdges.some((e) => e.to === dk)) termEdges.push({ to: dk, dist: 0 });
    } else {
      const doorEdges = edgesFor(graph, dk);
      if (!doorEdges.some((e) => e.to === termKey)) doorEdges.push({ to: termKey, dist: 0 });
    }
  }
  return termKey;
}

// Attaches an arbitrary dropped pin the same way a doorway joins the network:
// perpendicular projection onto the nearest walkable corridor, spliced between
// the nearest nodes on that corridor, plus a straight stub or one elbow.
function attachFreePoint(graph: Graph, [x, y]: Point, floor: Floor) {
  const existing = `${x},${y}`;
  if (graph.nodes[existing]) return existing;

  const foot = projectOntoNearestCorridor([x, y], floor, { walkableOnly: true });
  if (!foot) return null;

  const ensure = (px: number, py: number) => {
    const k = `${px},${py}`;
    if (!graph.nodes[k]) {
      graph.nodes[k] = { id: k, x: px, y: py };
      edgesFor(graph, k);
    }
    return k;
  };
  const link = (a: string, b: string) => {
    if (a === b) return;
    const na = graph.nodes[a];
    const nb = graph.nodes[b];
    const dist = Math.hypot(nb.x - na.x, nb.y - na.y);
    const ea = edgesFor(graph, a);
    if (!ea.some((e) => e.to === b)) ea.push({ to: b, dist });
    const eb = edgesFor(graph, b);
    if (!eb.some((e) => e.to === a)) eb.push({ to: a, dist });
  };

  const corr = foot.corr;
  const horizontal = isHorizontal(corr);
  const footKey = ensure(foot.x, foot.y);

  let before: { key: string; at: number } | null = null;
  let after: { key: string; at: number } | null = null;
  for (const n of Object.values(graph.nodes)) {
    if (n.id === footKey || n.id.startsWith("room:")) continue;
    const onLine = isHorizontal(corr)
      ? Math.abs(n.y - foot.y) < 1e-6 &&
        n.x >= corr.xMin - JUNCTION_TOL && n.x <= corr.xMax + JUNCTION_TOL
      : Math.abs(n.x - foot.x) < 1e-6 &&
        n.y >= corr.yMin - JUNCTION_TOL && n.y <= corr.yMax + JUNCTION_TOL;
    if (!onLine) continue;
    const at = horizontal ? n.x : n.y;
    const at0 = horizontal ? foot.x : foot.y;
    if (at <= at0 && (before === null || at > before.at)) before = { key: n.id, at };
    if (at >= at0 && (after === null || at < after.at)) after = { key: n.id, at };
  }
  if (before) link(footKey, before.key);
  if (after) link(footKey, after.key);

  const pointKey = ensure(x, y);
  if (x === foot.x || y === foot.y) {
    link(pointKey, footKey);
  } else {
    const elbow = horizontal ? ensure(x, foot.y) : ensure(foot.x, y);
    link(pointKey, elbow);
    link(elbow, footKey);
  }
  return pointKey;
}

function ensureStairInGraph(graph: Graph, stairNum: number, floor: Floor) {
  const pos = STAIR_POSITIONS[stairNum]?.[floor];
  return pos ? ensurePointInGraph(graph, pos) : null;
}

// Drops the zero-length hop into/out of a room terminal. Rooms 272 and 274
// share one doorway, so their walk collapses to a point; return it twice so a
// map can still draw a start and an end marker.
function trimTerminals(path: Point[] | undefined, trimStart: boolean, trimEnd: boolean): Point[] {
  if (!path) return [];
  let out = path;
  if (trimStart && out.length > 1) out = out.slice(1);
  if (trimEnd && out.length > 1) out = out.slice(0, -1);
  if (out.length === 1) out = [out[0], out[0]];
  return out;
}

// ─── Walking-time estimate ────────────────────────────────────────────────────

const MAP_WIDTH_PX = 2448; // the blueprint space every coordinate is in
const METERS_PER_MAP_WIDTH = 140; // approximate real width the plan spans
const M_PER_PX = METERS_PER_MAP_WIDTH / MAP_WIDTH_PX;
const WALK_SPEED_MPS = 1.3; // average indoor walking speed
const STAIR_SECONDS = 25; // added per floor changed

function pathLengthPx(points: readonly Point[] | null) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// `minutes` is never 0: "0 min" reads as "already there" for a real walk.
export function estimateWalk(
  path1: readonly Point[] | null,
  path2: readonly Point[] | null,
  floorsChanged: number,
) {
  const meters = (pathLengthPx(path1) + pathLengthPx(path2)) * M_PER_PX;
  const seconds = meters / WALK_SPEED_MPS + Math.abs(floorsChanged || 0) * STAIR_SECONDS;
  return { meters: Math.round(meters), minutes: Math.max(1, Math.round(seconds / 60)) };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const LABEL_BY_KEY: Record<string, string> = {};
for (const floor of FLOORS) {
  for (const label of ROOM_LABELS[floor]) {
    LABEL_BY_KEY[getRoomKey(label, floor)] = label;
  }
}

// The school's own label for a room ("Room 392/394", "Reception").
export function labelFor(roomStr: string, floor: Floor) {
  const known = LABEL_BY_KEY[canonicalRoomKey(roomStr, floor) ?? getRoomKey(roomStr, floor)];
  if (!known) return String(roomStr);
  return /^\d/.test(known) ? `Room ${known}` : known;
}

function endpointLabel(ep: Endpoint) {
  return ep.kind === "room"
    ? labelFor(ep.room, ep.floor)
    : `Pinned spot on Floor ${ep.floor}`;
}

function addEndpoint(graph: Graph, ep: Endpoint, dir: "in" | "out") {
  return ep.kind === "room"
    ? addRoomTerminal(graph, ep.room, ep.floor, dir)
    : attachFreePoint(graph, [ep.x, ep.y], ep.floor);
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/** The shortest walk between two endpoints, each a room or a dropped pin. */
export function findRoute(from: Endpoint, to: Endpoint): RouteResult {
  const fromFloor = from.floor;
  const toFloor = to.floor;
  const trimStart = from.kind === "room";
  const trimEnd = to.kind === "room";

  if (!FLOORS.includes(fromFloor) || !FLOORS.includes(toFloor)) {
    return {
      error: "Unknown floor", sameFloor: fromFloor === toFloor, fromFloor, toFloor,
      fromLabel: endpointLabel(from), toLabel: endpointLabel(to),
      path1: [], path2: [], stairNum: null, stairFromPos: null, stairToPos: null,
    };
  }

  const fromLabel = endpointLabel(from);
  const toLabel = endpointLabel(to);
  const none = { stairNum: null, stairFromPos: null, stairToPos: null };

  if (fromFloor === toFloor) {
    const graph = overlayGraph(getGraph(fromFloor));
    const startKey = addEndpoint(graph, from, "out");
    const endKey = addEndpoint(graph, to, "in");
    if (!startKey || !endKey) {
      return { error: "Room not found", sameFloor: true, fromFloor, toFloor, fromLabel, toLabel, path1: [], path2: null, ...none };
    }
    const result = dijkstra(graph, startKey, endKey);
    if (!result) {
      return { error: "No path found", sameFloor: true, fromFloor, toFloor, fromLabel, toLabel, path1: [], path2: null, ...none };
    }
    const path1 = trimTerminals(result.path, trimStart, trimEnd);
    return {
      sameFloor: true, fromFloor, toFloor, fromLabel, toLabel,
      path1, path2: null, ...none,
      ...estimateWalk(path1, null, 0),
    };
  }

  // Stairs with no floor-1 landing are only candidates between floors 2 and 3.
  const touchesFloor1 = fromFloor === 1 || toFloor === 1;
  const accessibleStairs = Object.keys(STAIR_POSITIONS)
    .map(Number)
    .filter((id) => !(touchesFloor1 && UPPER_FLOOR_ONLY_STAIRS.has(id)))
    .sort((a, b) => a - b);

  const graphFrom = overlayGraph(getGraph(fromFloor));
  const graphTo = overlayGraph(getGraph(toFloor));
  const startKey = addEndpoint(graphFrom, from, "out");
  const endKey = addEndpoint(graphTo, to, "in");

  let best: { leg1: { path: Point[] }; leg2: { path: Point[] }; stairNum: number } | null = null;
  let bestCost = Infinity;

  if (startKey && endKey) {
    for (const stairNum of accessibleStairs) {
      const stairFromKey = ensureStairInGraph(graphFrom, stairNum, fromFloor);
      const stairToKey = ensureStairInGraph(graphTo, stairNum, toFloor);
      if (!stairFromKey || !stairToKey) continue;

      const leg1 = dijkstra(graphFrom, startKey, stairFromKey);
      if (!leg1) continue;
      const leg2 = dijkstra(graphTo, stairToKey, endKey);
      if (!leg2) continue;

      const totalCost = leg1.cost + leg2.cost;
      if (totalCost < bestCost) {
        bestCost = totalCost;
        best = { leg1, leg2, stairNum };
      }
    }
  }

  if (!best) {
    return { error: "No path found", sameFloor: false, fromFloor, toFloor, fromLabel, toLabel, path1: [], path2: [], ...none };
  }

  const path1 = trimTerminals(best.leg1.path, trimStart, false);
  const path2 = trimTerminals(best.leg2.path, false, trimEnd);
  return {
    sameFloor: false, fromFloor, toFloor, fromLabel, toLabel,
    path1, path2,
    stairNum: best.stairNum,
    stairFromPos: STAIR_POSITIONS[best.stairNum][fromFloor] ?? null,
    stairToPos: STAIR_POSITIONS[best.stairNum][toFloor] ?? null,
    ...estimateWalk(path1, path2, toFloor - fromFloor),
  };
}

/** Room-to-room shorthand for findRoute. */
export function findPath(fromRoom: string, fromFloor: Floor, toRoom: string, toFloor: Floor) {
  return findRoute(
    { kind: "room", room: fromRoom, floor: fromFloor },
    { kind: "room", room: toRoom, floor: toFloor },
  );
}

/** Every stairwell with a landing on both floors, lowest id first. */
export function stairsBetween(floorA: Floor, floorB: Floor) {
  return Object.keys(STAIR_POSITIONS)
    .map(Number)
    .filter((id) => STAIR_POSITIONS[id][floorA] && STAIR_POSITIONS[id][floorB])
    .sort((a, b) => a - b);
}

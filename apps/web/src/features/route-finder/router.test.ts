// Exhaustive check of the router against the school's marked-up plans, ported
// from IA Nexus (backend/test/routes.test.js): every ordered pair of rooms must
// have a route that starts and ends at a real doorway, turns only at right
// angles, and runs along a mapped hallway everywhere in between.

import { describe, expect, test } from "vitest";
import {
  CORRIDORS,
  FLOORS,
  ROOM_DOORS,
  ROOM_LABELS,
  STAIR_POSITIONS,
  type Floor,
  type Point,
} from "./building-data";
import { estimateWalk, findPath, findRoute, labelFor, labelForStair } from "./router";

const EPS = 1.5; // px of slack for a point sitting "on" a corridor
const JUNCTION_TOL = 30; // the router's documented junction slack

const key = (room: string, floor: Floor) =>
  `${floor}:${room.toLowerCase().replace(/\s+/g, "")}`;
const doorsOf = (room: string, floor: Floor) => ROOM_DOORS[key(room, floor)] ?? [];
const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

// Doorways and stair landings are the only points allowed off the hallways.
function offNetworkPoints(floor: Floor) {
  const pts: Point[] = [];
  for (const [k, doors] of Object.entries(ROOM_DOORS)) {
    if (parseInt(k.split(":")[0], 10) === floor) pts.push(...doors);
  }
  for (const landings of Object.values(STAIR_POSITIONS)) {
    const landing = landings[floor];
    if (landing) pts.push(landing);
  }
  return pts;
}

function expectAxisAligned(path: readonly Point[], what: string) {
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1];
    const [x1, y1] = path[i];
    expect(
      Math.abs(x1 - x0) < EPS || Math.abs(y1 - y0) < EPS,
      `${what}: diagonal leg ${JSON.stringify(path[i - 1])} -> ${JSON.stringify(path[i])}`,
    ).toBe(true);
  }
}

// How far segment a-b spills past the nearest collinear corridor's ends, or
// null when no corridor is collinear with it.
function overhangAlongCorridor(a: Point, b: Point, floor: Floor) {
  const c = CORRIDORS[floor];
  let best: number | null = null;
  const consider = (over: number) => {
    if (best === null || over < best) best = over;
  };
  if (Math.abs(a[1] - b[1]) < EPS) {
    for (const h of c.horizontal) {
      if (Math.abs(a[1] - h.y) > EPS) continue;
      const lo = Math.min(a[0], b[0]);
      const hi = Math.max(a[0], b[0]);
      consider(Math.max(0, h.xMin - lo) + Math.max(0, hi - h.xMax));
    }
  }
  if (Math.abs(a[0] - b[0]) < EPS) {
    for (const v of c.vertical) {
      if (Math.abs(a[0] - v.x) > EPS) continue;
      const lo = Math.min(a[1], b[1]);
      const hi = Math.max(a[1], b[1]);
      consider(Math.max(0, v.yMin - lo) + Math.max(0, hi - v.yMax));
    }
  }
  return best;
}

function expectOnHallways(path: readonly Point[], floor: Floor, what: string) {
  const offNetwork = offNetworkPoints(floor);
  const isOffNetwork = (p: Point | undefined) => !!p && offNetwork.some((a) => same(a, p));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (same(a, b)) continue;
    const over = overhangAlongCorridor(a, b, floor);
    if (over !== null && over <= JUNCTION_TOL) continue;
    // A stub out of a doorway or landing, or the elbow next to one.
    if (isOffNetwork(a) || isOffNetwork(b) || isOffNetwork(path[i - 2]) || isOffNetwork(path[i + 1])) {
      continue;
    }
    expect.fail(
      `${what}: segment ${JSON.stringify(a)} -> ${JSON.stringify(b)} on floor ${floor} leaves the hallways`,
    );
  }
}

describe("route finder", () => {
  test("directions use landmark names for stairs without confirmed school numbers", () => {
    expect(labelForStair(9)).toBe("West Xchange/Library stairs");
    expect(labelForStair(10)).toBe("East Xchange/Library stairs");
    expect(labelForStair(1)).toBe("Stair 1");
  });
  test("every room on the plans has at least one doorway", () => {
    for (const floor of FLOORS) {
      for (const room of ROOM_LABELS[floor]) {
        expect(doorsOf(room, floor).length, `floor ${floor}: ${room}`).toBeGreaterThan(0);
      }
    }
  });

  test.each(FLOORS)("floor %i: every same-floor room pair", (floor) => {
    const rooms = ROOM_LABELS[floor];
    for (const from of rooms) {
      for (const to of rooms) {
        if (from === to) continue;
        const what = `floor ${floor} ${from} -> ${to}`;
        const r = findPath(from, floor, to, floor);
        expect(r.error, what).toBeUndefined();
        expect(r.path1.length, what).toBeGreaterThanOrEqual(2);
        expect(doorsOf(from, floor).some((d) => same(d, r.path1[0])), `${what}: start`).toBe(true);
        expect(doorsOf(to, floor).some((d) => same(d, r.path1.at(-1)!)), `${what}: end`).toBe(true);
        expectAxisAligned(r.path1, what);
        expectOnHallways(r.path1, floor, what);
      }
    }
  });

  test("every room pair between different floors", { timeout: 20_000 }, () => {
    for (const fromFloor of FLOORS) {
      for (const toFloor of FLOORS) {
        if (fromFloor === toFloor) continue;
        for (const from of ROOM_LABELS[fromFloor]) {
          for (const to of ROOM_LABELS[toFloor]) {
            const what = `${from} (F${fromFloor}) -> ${to} (F${toFloor})`;
            const r = findPath(from, fromFloor, to, toFloor);
            expect(r.error, what).toBeUndefined();
            const stair = STAIR_POSITIONS[r.stairNum!];
            const path2 = r.path2!;
            expect(doorsOf(from, fromFloor).some((d) => same(d, r.path1[0])), `${what}: start`).toBe(true);
            expect(same(r.path1.at(-1)!, stair[fromFloor]!), `${what}: leg 1 ends at stair`).toBe(true);
            expect(same(path2[0], stair[toFloor]!), `${what}: leg 2 starts at stair`).toBe(true);
            expect(doorsOf(to, toFloor).some((d) => same(d, path2.at(-1)!)), `${what}: end`).toBe(true);
            expectAxisAligned(r.path1, `${what} leg 1`);
            expectAxisAligned(path2, `${what} leg 2`);
            expectOnHallways(r.path1, fromFloor, `${what} leg 1`);
            expectOnHallways(path2, toFloor, `${what} leg 2`);
          }
        }
      }
    }
  });

  test("a stairwell with no floor-1 landing is never used for a floor-1 trip", () => {
    for (const floor of [2, 3] as const) {
      for (const from of ROOM_LABELS[floor]) {
        for (const to of ROOM_LABELS[1]) {
          const r = findPath(from, floor, to, 1);
          expect(STAIR_POSITIONS[r.stairNum!]?.[1], `${from} -> ${to} via ${r.stairNum}`).toBeDefined();
        }
      }
    }
  });

  test("one half of a shared-door pair resolves to the pair", () => {
    const r = findPath("392", 3, "301", 3);
    expect(r.error).toBeUndefined();
    expect(r.fromLabel).toBe("Room 392/394");
    expect(labelFor("Reception", 1)).toBe("Reception");
  });

  test("an unknown room reports an error instead of an empty route", () => {
    expect(findPath("999", 1, "116", 1).error).toBeDefined();
    expect(findPath("999", 1, "301", 3).error).toBeDefined();
  });

  test("a dropped pin routes along the hallways to a room", () => {
    const r = findRoute({ kind: "point", x: 1000, y: 320, floor: 3 }, { kind: "room", room: "301", floor: 3 });
    expect(r.error).toBeUndefined();
    expect(r.path1[0]).toEqual([1000, 320]);
    expect(doorsOf("301", 3).some((d) => same(d, r.path1.at(-1)!))).toBe(true);
    expectAxisAligned(r.path1, "pin -> 301");
  });

  test("a walk is never estimated at zero minutes", () => {
    expect(estimateWalk([[0, 0], [1, 0]], null, 0).minutes).toBe(1);
    expect(findPath("272", 2, "274", 2).minutes).toBe(1);
  });
});

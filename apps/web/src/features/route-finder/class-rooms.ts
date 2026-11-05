// Getting from one class to the next. Class schedules don't record rooms, so a
// student picks each class's room once and this browser remembers it. Storage
// can throw (private mode, blocked site data), so reads and writes degrade to
// "no rooms known" and the student just picks again.

import { FLOORS, ROOM_LABELS, type Floor } from "./building-data";
import { ALL_ROOMS, type RoomOption } from "./room-search";

export const CLASS_ROOMS_KEY = "ia_route_finder_class_rooms";

export type ClassRooms = Readonly<Record<string, RoomOption>>;
export type RoutePlace = { title: string; location?: string };

const isRoom = (v: unknown): v is RoomOption => {
  if (!v || typeof v !== "object") return false;
  const { room, floor } = v as Record<string, unknown>;
  return (
    FLOORS.includes(floor as Floor) &&
    typeof room === "string" &&
    ROOM_LABELS[floor as Floor].includes(room)
  );
};

export function readClassRooms(): ClassRooms {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CLASS_ROOMS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, room]) => isRoom(room)));
  } catch {
    return {};
  }
}

export function rememberClassRooms(rooms: ReadonlyArray<readonly [string, RoomOption]>) {
  try {
    const next = { ...readClassRooms(), ...Object.fromEntries(rooms) };
    window.localStorage.setItem(CLASS_ROOMS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the student picks the room again next time.
  }
}

/**
 * The one room a place written elsewhere in the app names, such as a workshop's
 * location. A near match could send someone to the wrong door, so there's no
 * typo tolerance, and a room on two floors isn't one room.
 */
export function roomForLocation(location: string | undefined): RoomOption | undefined {
  if (!location) return undefined;
  const name = location
    .trim()
    .replace(/^(?:room|rm)\.?\s*/i, "")
    .toLowerCase();
  const matches = ALL_ROOMS.filter((option) => option.room.toLowerCase() === name);
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * The passing period at this minute: one class has ended and the next hasn't
 * started. Before the first class, during a class, and after the last, there's
 * nowhere to walk from or to, so null. `items` must be sorted by start.
 */
export function passingPeriod<T extends { start: number; end: number }>(
  items: readonly T[],
  minutes: number,
): { from: T; to: T } | null {
  if (items.some((item) => item.start <= minutes && minutes < item.end)) return null;
  const from = items.findLast((item) => item.end <= minutes);
  const to = items.find((item) => item.start > minutes);
  return from && to ? { from, to } : null;
}

/** The Route Finder link that opens straight on the way from one place to the next. */
export function classRouteHref(from: RoutePlace | undefined, to: RoutePlace | undefined): string {
  const query = new URLSearchParams();
  const add = (side: "from" | "to", place: RoutePlace | undefined) => {
    if (!place) return;
    const room = roomForLocation(place.location);
    if (room) {
      query.set(side, room.room);
      query.set(`${side}Floor`, String(room.floor));
    } else {
      query.set(`${side}Class`, place.title);
    }
  };
  add("from", from);
  add("to", to);
  const search = query.toString();
  return search ? `/route-finder?${search}` : "/route-finder";
}

export type RouteSide = { room: RoomOption | null; className: string | null };

/** What a Route Finder link asks for, filling classes in from the rooms already picked. */
export function parseRouteLink(
  search: string,
  classRooms: ClassRooms,
): { from: RouteSide; to: RouteSide } {
  const query = new URLSearchParams(search);
  const side = (name: "from" | "to"): RouteSide => {
    const direct = { room: query.get(name), floor: Number(query.get(`${name}Floor`)) };
    if (isRoom(direct)) return { room: direct as RoomOption, className: null };
    const className = query.get(`${name}Class`);
    if (!className) return { room: null, className: null };
    return {
      room: Object.hasOwn(classRooms, className) ? classRooms[className] : null,
      className,
    };
  };
  return { from: side("from"), to: side("to") };
}

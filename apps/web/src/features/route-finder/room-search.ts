// Forgiving room search for the Route Finder's single room list.
//
// Students type rooms the way they say them: "331", "room 331", "Rm 331",
// "gym", "the library", "audotorium". Matching ignores case, punctuation and
// filler words like "room", and tolerates a typo or two in names.

import { FLOORS, ROOM_LABELS, type Floor } from "./building-data";

export type RoomOption = { room: string; floor: Floor };

/** Every room in the building, floor by floor, in the school's own order. */
export const ALL_ROOMS: readonly RoomOption[] = FLOORS.flatMap((floor) =>
  ROOM_LABELS[floor].map((room) => ({ room, floor })),
);

const FILLER = new Set(["room", "rm", "rooms", "the", "to", "floor", "flr"]);

// Everyday names for places whose label students might not use.
const NICKNAMES: Readonly<Record<string, string>> = {
  Clinic: "nurse health",
  Reception: "front office main office",
  GYM: "gymnasium",
  Auditorium: "theater theatre stage",
  "Xchange/Library": "exchange",
  "Mission Control": "mc",
};

/** Lowercase words with punctuation and filler removed: "Room #331!" -> ["331"]. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z])(\d)|(\d)([a-z])/g, "$1$3 $2$4")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !FILLER.has(word));
}

/** Edit distance that counts a swap of two neighbouring letters as one typo. */
function typoDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many typos a word of this length may carry and still count. */
const allowedTypos = (length: number) => (length <= 2 ? 0 : length <= 4 ? 1 : 2);

/**
 * Score one query word against one room word; lower is better, null is no match.
 * Exact beats the start of a word, which beats a typo, which beats a fragment
 * from the middle of a word ("est" is a typo of "east" before it is "west").
 */
function wordScore(query: string, target: string): number | null {
  if (target === query) return 0;
  if (target.startsWith(query)) return 1;
  const inside = target.includes(query) ? 5 : null;
  // Numbers are matched literally: "313" is not a typo of "331".
  if (/^\d+$/.test(query)) return inside;
  // A typo in a word being typed: compare against the same-length start too.
  const prefix = target.slice(0, query.length);
  const distance = Math.min(typoDistance(query, target), typoDistance(query, prefix));
  return distance <= allowedTypos(query.length) ? 2 + distance : inside;
}

/** Rooms matching what the student typed, best match first. Empty query lists every room. */
export function searchRooms(query: string): RoomOption[] {
  // "floor 3" / "3rd floor" narrows the list to that floor.
  const floorMatch = query.toLowerCase().match(/\b(?:floor|flr)\s*([123])\b|\b([123])(?:st|nd|rd)?\s*(?:floor|flr)\b/);
  const onFloor = floorMatch ? (Number(floorMatch[1] ?? floorMatch[2]) as Floor) : null;
  const rest = floorMatch ? query.toLowerCase().replace(floorMatch[0], " ") : query;
  const candidates = onFloor ? ALL_ROOMS.filter((option) => option.floor === onFloor) : ALL_ROOMS;

  const queryWords = words(rest);
  if (queryWords.length === 0) return [...candidates];

  const scored: Array<{ option: RoomOption; score: number; index: number }> = [];
  candidates.forEach((option, index) => {
    // A shared-door pair ("381/383") is found by either number.
    const roomWords = words(
      `${option.room.replace("/", " ")} ${option.room} ${NICKNAMES[option.room] ?? ""}`,
    );
    let total = 0;
    for (const queryWord of queryWords) {
      let best: number | null = null;
      for (const roomWord of roomWords) {
        const score = wordScore(queryWord, roomWord);
        if (score !== null && (best === null || score < best)) best = score;
      }
      if (best === null) return;
      total += best;
    }
    scored.push({ option, score: total, index });
  });

  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ option }) => option);
}

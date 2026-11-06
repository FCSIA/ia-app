// Building data for the Route Finder, ported from IA Nexus
// (jackiedv2011/ia-nexus-school-navigation, backend/data/roomCoordinates.js).
//
// Every coordinate is in the original blueprint's 2448x1584 pixel space.
// Corridors, doorways and the room list were derived from the school's
// marked-up floor plans (red = walkable hallways, green = doorways, yellow =
// rooms that exist). See the IA Nexus source for the full survey notes on each
// stairwell.

export type Floor = 1 | 2 | 3;
export type Point = readonly [number, number];

export type HorizontalCorridor = { y: number; xMin: number; xMax: number };
export type VerticalCorridor = { x: number; yMin: number; yMax: number };
export type FloorCorridors = {
  horizontal: readonly HorizontalCorridor[];
  vertical: readonly VerticalCorridor[];
};

export const FLOORS: readonly Floor[] = [1, 2, 3];

// STAIR_POSITIONS[stairId][floor] = [x, y], the physical landing on that floor.
// A stairwell with no entry for a floor has no landing there, and the router
// never routes through it on that floor. Ids 9 and 10 are placeholders until
// the school confirms real numbers for the two Xchange/Library staircases.
export const STAIR_POSITIONS: Readonly<Record<number, Partial<Record<Floor, Point>>>> = {
  1: { 2: [607, 188],   3: [623, 206]   }, // the school's real "Stair 1"; floors 2-3 only
  4: { 1: [1309, 1266], 2: [719, 1460],  3: [723, 1496]  },
  5: { 1: [2093, 1255], 2: [1686, 1457], 3: [1695, 1500] },
  7: { 1: [1735, 233],  2: [1272, 166],  3: [1287, 196]  },
  8: { 1: [2147, 222],  2: [1790, 178],  3: [1797, 198]  },
  // Floor 1's landing is the stair icon next to room 123, identified by the
  // school. Its raw floor-1 -> floor-2 offset looks alarming (562px, 32m)
  // until you notice every other stairwell has one too — see FLOOR 1'S
  // COORDINATE OFFSET below. Against that systematic shift it is a 7m
  // residual, the middle of the pack.
  2: { 1: [1363, 852],  2: [801, 1023],  3: [822, 1060]  },
  3: { 2: [1598, 1030], 3: [1619, 1051] }, // floors 2-3 only
  // The WEST Xchange/Library staircase — this file's placeholder "9" (it
  // held id "1" until the school identified a different stairwell as the
  // real Stair 1; see the header comment). Floors 1-2 only: its floor-1
  // landing is the one by Hangar West / Mission Control, which sits below
  // the Xchange/Library, and which this file previously attributed to
  // stair 1.
  //
  // Against the systematic floor-1 shift below, this is the BEST-fitting
  // floor-1 landing of the eight (3m residual, where the confirmed stairs 4,
  // 7 and 8 sit at 9-10m) — independent support for the school's placement.
  //
  // This file previously also gave stair 9 a floor-3 landing 288px (16m)
  // east of its floor-2 one, on the theory that it was one real staircase
  // with an unusually large offset — the one genuine outlier in a table
  // where every other stairwell moves 1-3m between floors 2 and 3. The
  // school has since pointed out that spot is a SEPARATE staircase; see
  // stair 10 below.
  9: { 1: [1514, 628], 2: [1073, 666] },
  // The EAST Xchange/Library staircase — this file's placeholder "10".
  // Floors 2-3 only. Its floor-2 landing sits ~254px (14.5m) east of
  // stair 9's, and only 35px (2m) from stair 10's own floor-3 landing
  // below — a better floor-2/3 fit than any pairing in this table, and
  // the reason the two were told apart: a single physical stairwell would
  // not jump 16m sideways between two floors that share a coordinate
  // origin, and now none does.
  10: { 2: [1327, 664], 3: [1361, 673] },
};

// Stairwells with no floor-1 landing; a route touching floor 1 skips them.
export const UPPER_FLOOR_ONLY_STAIRS: ReadonlySet<number> = new Set([1, 3, 10]);

// The walkable hallways, as axis-aligned segments. These are the only routes
// through the building.
export const CORRIDORS: Readonly<Record<Floor, FloorCorridors>> = {
  1: {
    horizontal: [
      { y:  319, xMin: 1668, xMax: 2161 },
      { y:  462, xMin:  289, xMax: 1135 },
      { y:  496, xMin: 1136, xMax: 2171 },
      { y:  644, xMin: 1193, xMax: 1473 },
      { y:  670, xMin: 1474, xMax: 2171 },
      { y:  700, xMin:  297, xMax: 1192 },
      { y:  835, xMin: 1199, xMax: 1684 },
      { y:  896, xMin: 1668, xMax: 1737 },
    ],
    vertical: [
      { x:  283, yMin:  457, yMax:  696 },
      { x: 1131, yMin:  453, yMax:  699 },
      { x: 1193, yMin:  641, yMax: 1225 },
      { x: 1466, yMin:  487, yMax:  670 },
      { x: 1678, yMin:  329, yMax:  979 },
      { x: 2166, yMin:  312, yMax: 1247 },
    ],
  },
  2: {
    horizontal: [
      { y:  294, xMin:  327, xMax: 2089 },
      { y:  512, xMin: 1194, xMax: 1577 },
      { y:  713, xMin: 1140, xMax: 1586 },
      { y:  826, xMin:  839, xMax:  907 },
      { y:  922, xMin:  589, xMax: 1827 },
    ],
    vertical: [
      { x:  594, yMin:  292, yMax: 1466 },
      { x: 1133, yMin:  632, yMax:  721 },
      { x: 1201, yMin:  287, yMax:  925 },
      { x: 1579, yMin:  499, yMax:  726 },
      { x: 1814, yMin:  284, yMax: 1467 },
    ],
  },
  3: {
    horizontal: [
      { y:  319, xMin:  316, xMax: 2081 },
      { y:  536, xMin:  949, xMax: 1216 },
      { y:  714, xMin:  946, xMax: 1212 },
      { y:  956, xMin:  593, xMax: 1837 },
    ],
    vertical: [
      { x:  600, yMin:  309, yMax: 1500 },
      { x:  949, yMin:  538, yMax:  715 },
      { x: 1209, yMin:  310, yMax:  965 },
      { x: 1835, yMin:  325, yMax: 1511 },
    ],
  },
};

// ─── ROOM DOORS ───────────────────────────────────────────────────────────────
// ROOM_DOORS['floor:roomkey'] = [[x, y], ...] — every doorway the plans mark for
// that room. A route starts and ends AT a doorway, and where a room has more
// than one the router picks whichever pair makes the walk shortest.
//
// Two neighbours may list the same point: that is a single doorway drawn on the
// wall they share. The open areas (the hangars, the GYM, the Xchange/Library)
// have no drawn doorway because they have no door — their point is where the
// hallway network passes them.

export const ROOM_DOORS: Readonly<Record<string, readonly Point[]>> = {
  // ── FLOOR 1 ──────────────────────────────────────────────────────────
  '1:116':                 [[1647, 259]],
  '1:121':                 [[1503, 859]],
  '1:123':                 [[1398, 852]],
  '1:144':                 [[1222, 951]],
  '1:147':                 [[1160, 993], [1164, 1200]],
  '1:157':                 [[2139, 1076]],
  '1:172':                 [[1865, 294]],
  '1:174':                 [[1903, 294]],
  '1:181':                 [[686, 728]],
  '1:184':                 [[482, 433], [671, 425]],
  '1:188':                 [[284, 431]],
  '1:189':                 [[283, 727]],
  '1:191':                 [[2196, 349]],
  '1:192':                 [[2205, 292]],
  '1:clinic':              [[1782, 683]],
  '1:courtyard':           [[1087, 581]],
  '1:gym':                 [[2166, 1024], [2196, 1208]],
  '1:hangareast':          [[1952, 496]],
  '1:hangarwest':          [[1295, 496]],
  '1:missioncontrol':      [[1512, 693]],
  '1:reception':           [[1752, 832], [1749, 892]],
  // The auditorium is reached through this door on the building's east wall,
  // just south of the "Towards Auditorium" hallway; routes end here.
  '1:auditorium':          [[2182, 713]],

  // ── FLOOR 2 ──────────────────────────────────────────────────────────
  '2:223':                 [[965, 961]],
  '2:233':                 [[1413, 956]],
  '2:235':                 [[1446, 956], [1592, 961]],
  '2:236':                 [[1527, 891], [1774, 889]],
  '2:242':                 [[628, 1031]],
  '2:244':                 [[629, 1285], [564, 1145]],
  '2:246':                 [[628, 1322], [624, 1459]],
  '2:249':                 [[563, 1406]],
  '2:251':                 [[1785, 1161]],
  '2:252':                 [[1845, 895]],
  '2:253':                 [[1787, 1226]],
  '2:258':                 [[1842, 1309]],
  '2:261':                 [[1265, 256]],
  '2:262':                 [[1133, 333]],
  '2:263':                 [[1100, 252]],
  '2:265':                 [[961, 258]],
  '2:267':                 [[711, 259]],
  '2:268':                 [[736, 332]],
  '2:272':                 [[1464, 256]],
  '2:273':                 [[1411, 337]],
  '2:274':                 [[1464, 256]],
  '2:275':                 [[1455, 331]],
  '2:277':                 [[1587, 330]],
  '2:281/283':             [[544, 262]],
  '2:282/284':             [[548, 334]],
  '2:291/293':             [[1857, 331]],
  '2:292/294':             [[1882, 257], [1824, 253]],
  '2:biotechlab':          [[964, 898]],
  '2:xchange/library':     [[1201, 592]],

  // ── FLOOR 3 ──────────────────────────────────────────────────────────
  '3:301':                 [[1263, 990]],
  '3:322':                 [[948, 920]],
  '3:324':                 [[913, 916]],
  '3:331':                 [[1428, 985]],
  '3:332':                 [[1425, 919]],
  '3:333':                 [[1466, 987]],
  '3:334':                 [[1463, 915]],
  '3:342':                 [[634, 1003]],
  '3:345':                 [[567, 1228]],
  '3:346':                 [[632, 1240]],
  '3:349':                 [[569, 1312]],
  '3:351':                 [[1798, 1010], [1798, 1227]],
  '3:354':                 [[1866, 1078], [1867, 814]],
  '3:356':                 [[1866, 1283], [1866, 1492]],
  '3:359':                 [[1805, 1284], [1801, 1449]],
  '3:362':                 [[1149, 354], [922, 355]],
  '3:363':                 [[1232, 274], [951, 279]],
  '3:364':                 [[657, 344], [879, 349]],
  '3:367':                 [[683, 279], [907, 278]],
  '3:372':                 [[1366, 277], [1597, 279]],
  '3:373':                 [[1277, 345]],
  '3:375':                 [[1568, 355]],
  '3:377':                 [[1608, 356]],
  '3:381/383':             [[553, 278]],
  '3:382/384':             [[556, 349]],
  '3:391/393':             [[2006, 349], [1878, 351]],
  '3:392/394':             [[2032, 282], [1875, 279]],
  '3:xchange/library':     [[1209, 617]],
};

// Exactly the rooms the school lists for each floor, as shown to a student.
// Drives the Route Finder's pickers.
export const ROOM_LABELS: Readonly<Record<Floor, readonly string[]>> = {
  1: ['116', '121', '123', '144', '147', '157', '172', '174', '181', '184',
      '188', '189', '191', '192', 'Clinic', 'Courtyard', 'GYM', 'Hangar East',
      'Hangar West', 'Mission Control', 'Reception', 'Auditorium'],
  2: ['223', '233', '235', '236', '242', '244', '246', '249', '251', '252',
      '253', '258', '261', '262', '263', '265', '267', '268', '272', '273',
      '274', '275', '277', '281/283', '282/284', '291/293', '292/294',
      'BioTech Lab', 'Xchange/Library'],
  3: ['301', '322', '324', '331', '332', '333', '334', '342', '345', '346',
      '349', '351', '354', '356', '359', '362', '363', '364', '367', '372',
      '373', '375', '377', '381/383', '382/384', '391/393', '392/394',
      'Xchange/Library'],
};

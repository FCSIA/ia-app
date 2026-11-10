// Floor plan drawings and the blueprint -> plan transform, ported from IA Nexus
// (frontend/src/lib/floorMaps.js).
//
// Routes are computed in the original blueprint's 2448x1584 pixel space. The
// school's issued floor plans are a redrawn version at a different scale and
// crop, so each floor carries the similarity transform onto its plan:
//
//     planX = blueprintX * scale + dx
//     planY = blueprintY * scale + dy
//
// w and h are each plan's size in those plan units. The drawings are transparent
// SVGs at three units per plan unit, redrawn from IA Nexus's floor plan images
// as even-width lines plus the building's shape; both take their colours from
// the --map-line and --map-floor CSS variables, and labels are drawn as text by
// MapLabels. Floor 1's drawing is wider than the plan the
// school issued: the auditorium is drawn to its right, beside the "Towards
// Auditorium" arrow. That only adds space on the right, so no coordinate moves.

import type { Floor } from "./building-data";

export type FloorMap = {
  src: string;
  w: number;
  h: number;
  scale: number;
  dx: number;
  dy: number;
};

export const FLOOR_MAPS: Readonly<Record<Floor, FloorMap>> = {
  1: { src: "/route-finder/floor1.svg", w: 1627, h: 681, scale: 0.50118, dx: -3.5, dy: -8.7 },
  2: { src: "/route-finder/floor2.svg", w: 873, h: 653, scale: 0.41653, dx: -76.1, dy: -1.2 },
  3: { src: "/route-finder/floor3.svg", w: 982, h: 762, scale: 0.49983, dx: -130.5, dy: -11.2 },
};

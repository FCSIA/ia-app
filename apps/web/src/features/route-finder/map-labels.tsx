// Room numbers and place names drawn as real text over a floor plan, ported
// from IA Nexus (frontend/src/components/MapLabels.jsx). The printed labels are
// erased from the served images so these stay sharp at every size.
//
// Positions are in the plan's own pixel space and placed as percentages so the
// layer scales with the image. A label keeps the plan's own size relative to
// the drawing (--natural), never drops below a readable floor on a phone, and
// never outgrows its room (--fit). The layer is its own size container, so cqw
// is a percentage of the map width.

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { Floor } from "./building-data";
import { FLOOR_MAPS } from "./floor-maps";
import MAP_LABELS from "./map-labels.json";

export type MapLabel = {
  text: string;
  x: number;
  y: number;
  size: number;
  fit?: number;
  lines?: string[];
  bold?: boolean;
  kind?: "place" | "minor";
  narrow?: "hide";
};

export const mapLabelsFor = (floor: Floor) =>
  ((MAP_LABELS as Record<string, MapLabel[]>)[floor] ?? []);

// A halo in the map's own floor colour keeps labels readable where they cross a line.
const HALO =
  "[text-shadow:0_0_2px_var(--map-floor),0_0_2px_var(--map-floor),0_0_3px_var(--map-floor),1px_0_0_var(--map-floor),-1px_0_0_var(--map-floor),0_1px_0_var(--map-floor),0_-1px_0_var(--map-floor)]";

export function MapLabels({ floor }: { floor: Floor }) {
  const map = FLOOR_MAPS[floor];
  return (
    <div className="@container pointer-events-none absolute inset-0 select-none" aria-hidden="true">
      {mapLabelsFor(floor).map((l) => {
        const secondary = l.kind === "place" || l.kind === "minor";
        return (
          <span
            key={l.text}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center whitespace-nowrap text-center leading-[1.12] tracking-[0.01em]",
              HALO,
              secondary
                ? "text-[length:min(var(--fit,100vw),max(9px,var(--natural)))]"
                : "text-[length:min(var(--fit,100vw),max(10px,var(--natural)))]",
              l.kind === "place" ? "font-medium text-muted-foreground" : l.kind === "minor" ? "font-semibold text-muted-foreground" : "font-semibold text-foreground",
              l.bold && "font-bold",
              l.narrow === "hide" && "@max-[560px]:hidden",
            )}
            style={
              {
                left: `${(l.x / map.w) * 100}%`,
                top: `${(l.y / map.h) * 100}%`,
                "--natural": `${(l.size / map.w) * 100}cqw`,
                ...(l.fit ? { "--fit": `${(l.fit / map.w) * 100}cqw` } : {}),
              } as CSSProperties
            }
          >
            {(l.lines ?? [l.text]).map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

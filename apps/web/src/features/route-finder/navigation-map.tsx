"use client";

// The computed route drawn over the school's floor plans, ported from IA Nexus
// (frontend/src/components/NavigationMap.jsx). The plan is a vector drawn in the
// theme's colours on a transparent background, room labels are a text layer, and
// the route and its markers are painted on a canvas on top.

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Floor, Point } from "./building-data";
import { FLOOR_MAPS } from "./floor-maps";
import { MapLabels, mapLabelsFor } from "./map-labels";
import { labelForStair, type RouteResult } from "./router";

const ROUTE_COLOR = "#E5484D";
const MARKER_COLORS = ["#16a34a", "#dc2626"]; // green = start, red = end

// Keeps the plan's shape and caps its height so a tall floor fits a laptop screen.
const MAP_FRAME_CLASS =
  "relative w-full max-w-[calc(80vh*var(--aspect))] self-center overflow-hidden [--map-floor:hsl(var(--muted))] [--map-line:hsl(var(--muted-foreground))]";

// The plan files are drawn at three units per pixel of the floor-map space.
const PLAN_UNITS_PER_PX = 3;

function MapCanvas({ floor, points, labels }: { floor: Floor; points: readonly Point[]; labels: [string, string] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const map = FLOOR_MAPS[floor];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = canvas.width / map.w;
    // Sizes are in plan pixels (x scale), with a floor in screen pixels (x dpr)
    // so the route and markers stay legible when the plan is shrunk on a phone.
    const dpr = window.devicePixelRatio || 1;
    const size = (planPx: number, minCssPx: number) => Math.max(planPx * scale, minCssPx * dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Blueprint space -> this floor plan's pixels -> canvas pixels.
    const scaled = points.map(([x, y]) => [
      (x * map.scale + map.dx) * scale,
      (y * map.scale + map.dy) * scale,
    ] as const);
    if (scaled.length < 2) return;

    // Dashed route line.
    ctx.save();
    ctx.setLineDash([size(9, 6), size(5, 3.5)]);
    ctx.lineWidth = size(3.5, 2.5);
    ctx.strokeStyle = ROUTE_COLOR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(scaled[0][0], scaled[0][1]);
    for (let i = 1; i < scaled.length; i++) ctx.lineTo(scaled[i][0], scaled[i][1]);
    ctx.stroke();
    ctx.restore();

    // Arrowhead on the final segment.
    const last = scaled[scaled.length - 1];
    const prev = scaled[scaled.length - 2];
    const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    const aLen = size(12, 9);
    ctx.save();
    ctx.fillStyle = ROUTE_COLOR;
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(last[0] - aLen * Math.cos(angle - 0.4), last[1] - aLen * Math.sin(angle - 0.4));
    ctx.lineTo(last[0] - aLen * Math.cos(angle + 0.4), last[1] - aLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Roughly where each room label sits, so a marker's bubble goes where it
    // hides the fewest of them, and never on the room it points at.
    const labelBoxes = mapLabelsFor(floor).map((l) => {
      const fs = Math.min(size(l.size, 10), l.fit ? l.fit * scale : Infinity);
      const lines = l.lines ?? [l.text];
      const w = Math.max(...lines.map((t) => t.length)) * fs * 0.6;
      const h = lines.length * fs * 1.15;
      const cx = l.x * scale;
      const cy = l.y * scale;
      return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2] as const;
    });
    const hidden = ([x1, y1, x2, y2]: readonly number[]) =>
      labelBoxes.reduce(
        (sum, [a1, b1, a2, b2]) =>
          sum + Math.max(0, Math.min(x2, a2) - Math.max(x1, a1)) * Math.max(0, Math.min(y2, b2) - Math.max(y1, b1)),
        0,
      );

    [scaled[0], scaled[scaled.length - 1]].forEach(([x, y], idx) => {
      const r = size(7, 5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = MARKER_COLORS[idx];
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = size(2, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const label = labels[idx];
      if (!label) return;
      ctx.save();
      const fs = size(9, 8);
      ctx.font = `bold ${fs}px Inter, sans-serif`;
      const tw = ctx.measureText(label).width;
      const pad = fs * 0.42;
      const bw = tw + pad * 2;
      const bh = fs * 1.5;
      const br = fs * 0.36;
      const gap = r + fs * 0.3;
      // Right, left, above or below the marker: whichever fits on the plan and
      // covers the least label text (ties go to the right).
      const clampX = (v: number) => Math.min(Math.max(v, 0), canvas.width - bw);
      const clampY = (v: number) => Math.min(Math.max(v, 0), canvas.height - bh);
      const spots = [
        [x + gap, y - bh / 2],
        [x - gap - bw, y - bh / 2],
        [x - bw / 2, y - gap - bh],
        [x - bw / 2, y + gap],
      ].map(([px, py]) => [clampX(px), clampY(py)] as const);
      // Clamping can push a bubble back over its own marker; that spot loses.
      const onMarker = ([px, py]: readonly number[]) =>
        px < x + r && px + bw > x - r && py < y + r && py + bh > y - r;
      const cost = (p: readonly number[]) => hidden([p[0], p[1], p[0] + bw, p[1] + bh]) + (onMarker(p) ? 1e9 : 0);
      const [bx, by] = spots.reduce((best, p) => (cost(p) < cost(best) ? p : best));
      ctx.fillStyle = MARKER_COLORS[idx];
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, br);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + pad, by + bh / 2);
      ctx.restore();
    });
  }, [floor, labels, map, points]);

  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    const frame = canvas?.parentElement;
    if (!canvas || !frame) return;

    // Size the canvas backing store to the frame at device resolution, and
    // redraw whenever the frame resizes so the route stays on the plan.
    const setup = () => {
      const displayW = frame.clientWidth || 600;
      const displayH = (displayW * map.h) / map.w;
      canvas.width = Math.round(displayW * window.devicePixelRatio);
      canvas.height = Math.round(displayH * window.devicePixelRatio);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;
      draw();
    };
    setup();

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(setup);
    });
    ro.observe(frame);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [draw, map]);

  return (
    <div className={MAP_FRAME_CLASS} style={{ "--aspect": map.w / map.h } as CSSProperties}>
      {/* <use> rather than <img>: only this way can the file take the theme's colours. */}
      <svg
        viewBox={`0 0 ${map.w * PLAN_UNITS_PER_PX} ${map.h * PLAN_UNITS_PER_PX}`}
        role="img"
        aria-label={`Floor ${floor} map`}
        className="block w-full select-none"
      >
        <use href={`${map.src}#plan`} />
      </svg>
      <MapLabels floor={floor} />
      <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" />
    </div>
  );
}

function Step({ title, floor, children }: { title: string; floor?: Floor; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">
        {title}
        {floor ? <span className="font-normal text-muted-foreground"> · Floor {floor}</span> : null}
      </h3>
      {children}
    </li>
  );
}

const SAME_FLOOR_LABELS: [string, string] = ["Start", "Destination"];

/** The route as steps, each leg drawn on its floor's plan. */
export function NavigationMap({ route }: { route: RouteResult }) {
  const { fromFloor, toFloor, sameFloor, path1, path2, stairNum, fromLabel, toLabel } = route;

  // A path needs two points to be drawn; say so rather than show a blank plan.
  const drawable = (p: readonly Point[] | null) => !!p && p.length >= 2;
  if (!drawable(path1) || (!sameFloor && !drawable(path2))) {
    return (
      <p className="text-sm text-muted-foreground" role="alert">
        No walkable route could be drawn between these two locations.
      </p>
    );
  }

  if (sameFloor) {
    return (
      <ol className="flex flex-col">
        <Step title={`${fromLabel} to ${toLabel}`} floor={fromFloor}>
          <MapCanvas floor={fromFloor} points={path1} labels={SAME_FLOOR_LABELS} />
        </Step>
      </ol>
    );
  }

  const stair = labelForStair(stairNum!);
  return (
    <ol className="flex flex-col gap-8">
      <Step title={`${fromLabel} to ${stair}`} floor={fromFloor}>
        <MapCanvas floor={fromFloor} points={path1} labels={["You are here", stair]} />
      </Step>
      <Step title={`Take ${stair} ${toFloor > fromFloor ? "up" : "down"} to Floor ${toFloor}`} />
      <Step title={`${stair} to ${toLabel}`} floor={toFloor}>
        <MapCanvas floor={toFloor} points={path2!} labels={[stair, "Destination"]} />
      </Step>
    </ol>
  );
}

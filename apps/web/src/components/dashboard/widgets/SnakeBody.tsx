"use client";

import { useLayoutEffect, useRef } from "react";
import { snakePoints } from "./snake-motion";

const rotation = { right: 0, down: 90, left: 180, up: 270 };

/** Animate only SVG geometry; React and the checkerboard update at game speed. */
export function SnakeBody({ snake, direction, width, height, duration, playing }: {
  snake: number[];
  direction: keyof typeof rotation;
  width: number;
  height: number;
  duration: number;
  playing: boolean;
}) {
  const body = useRef<SVGPolylineElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const previous = useRef(snake);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = snake;
    const draw = (progress: number) => {
      const points = snakePoints(from, snake, width, progress);
      body.current?.setAttribute("points", points.map(({ x, y }) => `${x},${y}`).join(" "));
      eyes.current?.setAttribute("transform", `translate(${points[0].x} ${points[0].y}) rotate(${rotation[direction]})`);
    };
    if (!playing || from === snake || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(1);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      draw(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    draw(0);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [snake, direction, width, duration, playing]);

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`}>
      <polyline ref={body} fill="none" className="stroke-primary" strokeWidth="0.82" strokeLinecap="round" strokeLinejoin="round" />
      <g ref={eyes} className="fill-primary-foreground">
        <circle cx="0.14" cy="-0.16" r="0.055" />
        <circle cx="0.14" cy="0.16" r="0.055" />
      </g>
    </svg>
  );
}

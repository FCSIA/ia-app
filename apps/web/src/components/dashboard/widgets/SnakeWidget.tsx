"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";

type Direction = "up" | "down" | "left" | "right";
type Game = { snake: number[]; food: number; direction: Direction; status: "ready" | "playing" | "paused" | "over" | "won" };
const initial = (): Game => ({ snake: [44, 43, 42], food: 46, direction: "right", status: "ready" });
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const keys: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

export function SnakeWidget({ layoutEditing = false }: { layoutEditing?: boolean }) {
  const [game, setGame] = useState<Game>(initial);
  const nextDirection = useRef<Direction>("right");
  const steer = (direction: Direction) => {
    if (direction !== opposite[game.direction]) nextDirection.current = direction;
  };
  useEffect(() => {
    if (game.status !== "playing" || layoutEditing) return;
    const timer = window.setInterval(() => {
      const random = Math.random();
      setGame((prev) => {
      if (prev.status !== "playing") return prev;
      const direction = nextDirection.current;
      const head = prev.snake[0];
      const x = head % 10 + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
      const y = Math.floor(head / 10) + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
      const target = y * 10 + x;
      const eating = target === prev.food;
      if (x < 0 || x > 9 || y < 0 || y > 9 || (eating ? prev.snake : prev.snake.slice(0, -1)).includes(target)) return { ...prev, status: "over" };
      const snake = [target, ...prev.snake.slice(0, eating ? undefined : -1)];
      if (!eating) return { ...prev, snake, direction };
      const free = Array.from({ length: 100 }, (_, i) => i).filter((i) => !snake.includes(i));
      if (!free.length) return { ...prev, snake, direction, status: "won" };
      return { ...prev, snake, direction, food: free[Math.floor(random * free.length)] };
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [game.status, layoutEditing]);
  const reset = () => { nextDirection.current = "right"; setGame({ ...initial(), status: "playing" }); };
  return (
    <Panel title="Snake">
      <div className="flex flex-col items-start gap-3" onKeyDown={(event) => { const direction = keys[event.key]; if (direction && game.status === "playing") { event.preventDefault(); steer(direction); } }}>
        <p className="text-sm text-muted-foreground" aria-live="polite">Score: {game.snake.length - 3}{game.status === "over" ? " · Game over" : game.status === "won" ? " · You won" : ""}</p>
        <div tabIndex={0} role="application" aria-label="Snake game. Use arrow keys to steer." className="grid w-full max-w-48 grid-cols-10 overflow-hidden rounded-md border border-border focus-visible:outline focus-visible:outline-ring">
          {Array.from({ length: 100 }, (_, i) => <span key={i} aria-hidden className={`aspect-square ${game.snake.includes(i) ? "bg-primary" : game.food === i ? "bg-destructive" : "bg-muted"}`} />)}
        </div>
        <div className="flex flex-wrap gap-2">
          {game.status === "ready" || game.status === "over" || game.status === "won" ? <Button size="sm" onClick={reset}> {game.status === "ready" ? "Start" : "Play again"}</Button> : <Button size="sm" onClick={() => setGame((prev) => ({ ...prev, status: prev.status === "playing" ? "paused" : "playing" }))}>{game.status === "playing" ? "Pause" : "Resume"}</Button>}
          {(["up", "left", "down", "right"] as const).map((direction) => <Button key={direction} size="sm" variant="ghost" disabled={game.status !== "playing"} onClick={() => steer(direction)} aria-label={`Move ${direction}`}>{ { up: "↑", left: "←", down: "↓", right: "→" }[direction]}</Button>)}
        </div>
      </div>
    </Panel>
  );
}

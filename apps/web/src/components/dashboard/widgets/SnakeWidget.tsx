"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";

type Direction = "up" | "down" | "left" | "right";
type Game = { snake: number[]; food: number; direction: Direction; status: "ready" | "playing" | "paused" | "over" | "won" };
const width = 16;
const height = 10;
const initial = (): Game => ({ snake: [72, 71, 70], food: 75, direction: "right", status: "ready" });
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const keys: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

export function SnakeWidget({ layoutEditing = false }: { layoutEditing?: boolean }) {
  const [game, setGame] = useState<Game>(initial);
  const nextDirection = useRef<Direction>("right");
  const board = useRef<HTMLDivElement>(null);
  const steer = (direction: Direction) => {
    if (direction !== opposite[game.direction]) nextDirection.current = direction;
  };
  useEffect(() => {
    if (game.status !== "playing" || layoutEditing) return;
    const timer = window.setInterval(() => {
      // Food needs a new random position after each successful move.
      const random = Math.random();
      setGame((prev) => {
        if (prev.status !== "playing") return prev;
        const direction = nextDirection.current;
        const head = prev.snake[0];
        const x = head % width + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
        const y = Math.floor(head / width) + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
        const target = y * width + x;
        const eating = target === prev.food;
        if (x < 0 || x >= width || y < 0 || y >= height || (eating ? prev.snake : prev.snake.slice(0, -1)).includes(target)) return { ...prev, status: "over" };
        const snake = [target, ...prev.snake.slice(0, eating ? undefined : -1)];
        if (!eating) return { ...prev, snake, direction };
        const free = Array.from({ length: width * height }, (_, i) => i).filter((i) => !snake.includes(i));
        if (!free.length) return { ...prev, snake, direction, status: "won" };
        return { ...prev, snake, direction, food: free[Math.floor(random * free.length)] };
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [game.status, layoutEditing]);
  const start = () => {
    if (game.status === "paused") setGame((prev) => ({ ...prev, status: "playing" }));
    else {
      nextDirection.current = "right";
      setGame({ ...initial(), status: "playing" });
    }
    board.current?.focus();
  };
  const controls = [
    { direction: "up", icon: ArrowUp },
    { direction: "left", icon: ArrowLeft },
    { direction: "down", icon: ArrowDown },
    { direction: "right", icon: ArrowRight },
  ] as const;
  return (
    <Panel title="Snake" action={
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          Score: {game.snake.length - 3}
        </span>
        <Button size="sm" variant="secondary" disabled={layoutEditing} onClick={game.status === "playing" ? () => setGame((prev) => ({ ...prev, status: "paused" })) : start}>
          {game.status === "playing" ? "Pause" : game.status === "paused" ? "Resume" : game.status === "ready" ? "Start" : "Play again"}
        </Button>
      </div>
    }>
      <div className="flex flex-col gap-3" onKeyDown={(event) => {
        const direction = keys[event.key];
        if (direction && game.status === "playing" && !layoutEditing) { event.preventDefault(); steer(direction); }
      }}>
        <div ref={board} tabIndex={0} role="application" aria-label="Snake game. Use arrow keys to steer." className="grid w-full grid-cols-16 bg-muted focus-visible:outline focus-visible:outline-ring">
          {Array.from({ length: width * height }, (_, i) => <span key={i} aria-hidden className={`aspect-square ${game.snake.includes(i) ? "bg-primary" : game.food === i ? "bg-destructive" : ""}`} />)}
        </div>
        {game.status === "over" || game.status === "won" ? <p role="status" className="text-sm">{game.status === "won" ? "You won" : "Game over"}</p> : null}
        <div className="grid w-fit grid-cols-3 gap-1 self-center" aria-label="Direction controls">
          {controls.map(({ direction, icon: Icon }, index) => (
            <Button key={direction} type="button" size="icon-sm" variant="secondary" disabled={game.status !== "playing" || layoutEditing} onClick={() => steer(direction)} aria-label={`Move ${direction}`} className={index === 0 ? "col-start-2" : index === 1 ? "col-start-1 row-start-2" : "row-start-2"}>
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation, useQuery } from "@/lib/convex-react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Direction = "up" | "down" | "left" | "right";
type Mode = "small" | "medium" | "large" | "extra-large";
type Game = { snake: number[]; food: number; direction: Direction; status: "ready" | "playing" | "paused" | "over" | "won" };
const modes: { id: Mode; label: string; width: number; height: number }[] = [
  { id: "small", label: "Small", width: 10, height: 8 },
  { id: "medium", label: "Medium", width: 16, height: 10 },
  { id: "large", label: "Large", width: 20, height: 12 },
  { id: "extra-large", label: "Extra Large", width: 24, height: 16 },
];
const initial = (width: number, height: number): Game => {
  const head = Math.floor(height / 2) * width + Math.floor(width / 2);
  return { snake: [head, head - 1, head - 2], food: head + 3, direction: "right", status: "ready" };
};
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const keys: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
const controls = [
  { direction: "up", icon: ArrowUp }, { direction: "left", icon: ArrowLeft },
  { direction: "down", icon: ArrowDown }, { direction: "right", icon: ArrowRight },
] as const;

export function SnakeWidget({ layoutEditing = false }: { layoutEditing?: boolean }) {
  const [mode, setMode] = useState<Mode>("medium");
  const { width, height } = modes.find(item => item.id === mode)!;
  const [game, setGame] = useState<Game>(() => initial(16, 10));
  const [saveError, setSaveError] = useState(false);
  const nextDirection = useRef<Direction>("right");
  const board = useRef<HTMLDivElement>(null);
  const leaderboard = useQuery(api.dashboard.snake.leaderboard, { mode });
  const submit = useMutation(api.dashboard.snake.submit);
  const score = game.snake.length - 3;
  const steer = (direction: Direction) => {
    if (direction !== opposite[game.direction]) nextDirection.current = direction;
  };
  useEffect(() => {
    if (game.status !== "playing" || layoutEditing) return;
    const timer = window.setInterval(() => {
      const random = Math.random();
      setGame(prev => {
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
        const free = Array.from({ length: width * height }, (_, i) => i).filter(i => !snake.includes(i));
        if (!free.length) return { ...prev, snake, direction, status: "won" };
        return { ...prev, snake, direction, food: free[Math.floor(random * free.length)] };
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [game.status, layoutEditing, width, height]);
  useEffect(() => {
    if ((game.status !== "over" && game.status !== "won") || score === 0) return;
    let active = true;
    void submit({ mode, score }).catch(() => { if (active) setSaveError(true); });
    return () => { active = false; };
  }, [game.status, score, mode, submit]);
  const start = () => {
    setSaveError(false);
    if (game.status === "paused") setGame(prev => ({ ...prev, status: "playing" }));
    else { nextDirection.current = "right"; setGame({ ...initial(width, height), status: "playing" }); }
    board.current?.focus();
  };
  return (
    <Panel title="Snake" action={<span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">Score: {score}</span>}>
      <div className="flex flex-col gap-3" onKeyDown={event => {
        const direction = keys[event.key];
        if (direction && game.status === "playing" && !layoutEditing) { event.preventDefault(); steer(direction); }
      }}>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mode} disabled={layoutEditing || game.status === "playing" || game.status === "paused"} onValueChange={value => {
            const selected = modes.find(item => item.id === value);
            if (!selected) return;
            nextDirection.current = "right"; setMode(selected.id); setGame(initial(selected.width, selected.height)); setSaveError(false);
          }}>
            <SelectTrigger aria-label="Board size" />
            <SelectContent>{modes.map((item, index) => <SelectItem key={item.id} index={index} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="secondary" disabled={layoutEditing} onClick={game.status === "playing" ? () => setGame(prev => ({ ...prev, status: "paused" })) : start}>
            {game.status === "playing" ? "Pause" : game.status === "paused" ? "Resume" : game.status === "ready" ? "Start" : "Play again"}
          </Button>
          <span className="text-sm text-muted-foreground">{width} × {height}</span>
        </div>
        <div ref={board} tabIndex={0} role="application" aria-label="Snake game. Use arrow keys to steer." className="grid w-full bg-muted focus-visible:outline focus-visible:outline-ring" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
          {Array.from({ length: width * height }, (_, i) => <span key={i} aria-hidden className={`aspect-square ${game.snake.includes(i) ? "bg-primary" : game.food === i ? "bg-destructive" : ""}`} />)}
        </div>
        {game.status === "over" || game.status === "won" ? <p role="status" className="text-sm">{game.status === "won" ? "You won!" : "Game over"}{saveError ? " Your score could not be saved." : ""}</p> : null}
        {saveError ? <Button size="sm" variant="secondary" onClick={() => {
          setSaveError(false);
          void submit({ mode, score }).catch(() => setSaveError(true));
        }}>Retry saving score</Button> : null}
        <div className="grid w-fit grid-cols-3 gap-1 self-center" aria-label="Direction controls">
          {controls.map(({ direction, icon: Icon }, index) => <Button key={direction} type="button" size="icon-sm" variant="secondary" disabled={game.status !== "playing" || layoutEditing} onClick={() => steer(direction)} aria-label={`Move ${direction}`} className={index === 0 ? "col-start-2" : index === 1 ? "col-start-1 row-start-2" : "row-start-2"}><Icon aria-hidden /></Button>)}
        </div>
        <div>
          <h3 className="text-sm font-medium">School leaderboard · {modes.find(item => item.id === mode)?.label}</h3>
          {leaderboard === undefined ? <p className="text-sm text-muted-foreground">Loading scores…</p> : leaderboard.length === 0 ? <p className="text-sm text-muted-foreground">No scores yet. Be the first!</p> : <Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead>Score</TableHead></TableRow></TableHeader><TableBody>{leaderboard.map((entry, index) => <TableRow key={`${entry.name}-${index}`} index={index}><TableCell>{index + 1}</TableCell><TableCell>{entry.name}{entry.isYou ? " (you)" : ""}</TableCell><TableCell>{entry.score}</TableCell></TableRow>)}</TableBody></Table>}
        </div>
      </div>
    </Panel>
  );
}
